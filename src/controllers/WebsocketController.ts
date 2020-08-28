// not exactly controller, but this one probably should be here (?)
import Application, { Context, Middleware } from 'koa'
import _debug from 'debug'
import koaCompose from 'koa-compose'
import WebSocket from 'ws'
import { isProduction, primarySelfDomain } from '@/config'
import { ISession } from '@/middlewares/01_session'
import { AnyKV } from '@/types/utils'
import { isPojo } from '@/helpers/object-utils'
import { IsIn, IsOptional, IsString } from 'class-validator'
import apiValidate from '@/helpers/api-validate'
import { Stream } from 'stream'
import { IsPojo } from '@/helpers/validators'
import { PushEventListener, PushService } from '@/services/PushService'
import { Expose } from 'class-transformer'
import { ApiError } from '@/types/errors'

const debug = _debug('api:ws')

class PerformApiCallOptions {
    @Expose()
    @IsString()
    path: string

    @Expose()
    @IsString()
    @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    @IsOptional()
    method?: string

    @Expose()
    @IsPojo({ canBeArray: true })
    @IsOptional()
    body?: AnyKV

    @Expose()
    @IsOptional()
    query: AnyKV
}

interface ExtendedWebsocket extends WebSocket {
    session: ISession
    pushHandler: PushEventListener
}

export default class WebsocketController {
    emptyBuffer = Buffer.alloc(0)

    handleRequest: (ctx: Context) => Promise<any>
    app: Application
    server: WebSocket.Server

    constructor (app: Application) {
        debug('Initializing WebSocket')
        this.app = app
        this.handleRequest = koaCompose(app.middleware)
        this.server = new WebSocket.Server({
            noServer: true
        })
    }

    middleware (): Middleware {
        return async (ctx: Context, next) => {
            if (ctx.path === '/api/ws') {
                const upgradeHeader = (ctx.request.headers.upgrade || '').split(',').map(s => s.trim())

                if (upgradeHeader.indexOf('websocket') === -1) {
                    ApiError.e('NO_UPGRADE', 'Upgrade header was not set, is it plain HTTP request?')
                }

                (ctx.req as any).session = ctx.session

                this.upgrade(ctx)

                ctx.respond = false
            } else {
                return next()
            }
        }
    }

    upgrade (ctx: Context) {
        this.server.handleUpgrade(ctx.req, ctx.socket, this.emptyBuffer, (ws: ExtendedWebsocket) => {
            ws.session = ctx.session

            ws.pushHandler = ((ev, notif) => {
                this.send(ws, {
                    act: 'push',
                    type: ev.u,
                    topics: ev.t,
                    progress: ev.p,
                    id: notif?.id ?? ev.i,
                    data: notif?.payload
                })
            })

            let u = ws.session.userId
            if (u) {
                PushService.instance.register(u, ws.pushHandler)
            }

            ws.on('message', (data) => {
                if (typeof data === 'string') {
                    if (data === 'KA') {
                        return ws.send('KAACK')
                    }

                    let json
                    try {
                        json = JSON.parse(data)
                    } catch (e) {
                        this.sendError(ws, 'INVALID_JSON')
                    }

                    this.handleJson(ws, json).catch(e => this.sendError(ws, e))
                } else {
                    this.sendError(ws, 'BINARY_UNSUPPORTED')
                }
            })

            ws.on('close', () => {
                PushService.instance.unregister(ws.session.userId!, ws.pushHandler)
            })
        })
    }

    async handleJson (ws: ExtendedWebsocket, json: AnyKV | AnyKV[], isNested = false): Promise<any> {
        if (Array.isArray(json)) {
            if (isNested) {
                ApiError.e('NESTED_ARR')
            }
            if (json.length > 10) {
                ApiError.e('TOO_MANY_REQUESTS')
            }

            return Promise.all(json.map(i => this.handleJson(ws, i, true)))
        }

        if (!isPojo(json)) {
            ApiError.e('INVALID_JSON')
        }

        const id = json.id
        let data

        if (json.act === 'api') {
            data = await this.performApiCall(json, ws)
        } else {
            ApiError.e('UNKNOWN_ACTION')
        }

        data.id = id
        data.ok = data.ok ?? true

        this.send(ws, data)
    }

    async performApiCall (json: AnyKV, ws: ExtendedWebsocket): Promise<any> {
        const session = ws.session
        const options = await apiValidate(PerformApiCallOptions, json)

        // holy fuck
        const socket = new Stream.Duplex()
        const req = Object.assign({ headers: {}, socket }, Stream.Readable.prototype) as any
        const res = Object.assign({ _headers: {}, socket }, Stream.Writable.prototype) as any
        (req.socket as any).remoteAddress = '127.0.0.1'
        res.getHeader = (k): string => res._headers[k.toLowerCase()]
        res.setHeader = (k, v): void => {
            res._headers[k.toLowerCase()] = v
        }
        res.removeHeader = (k): void => {
            delete res._headers[k.toLowerCase()]
        }

        // aight we are gonna mock this fella
        const mockCtx = this.app.createContext(req as any, res) as any

        if (options.method === 'POST' && !options.body) {
            options.body = {}
        }

        if (options.body) {
            req.headers['content-type'] = 'application/json'
            mockCtx.request.body = options.body
            mockCtx.request.rawBody = JSON.stringify(options.body)
        }

        // passing auth headers (cookie/bearer)
        if (session.$type === 'oauth') {
            req.headers['authorization'] = 'Bearer ' + session.$token
        } else if (session.$type === 'cookie') {
            req.headers['cookie'] = 'sid=' + session.$token
        }

        req.url = 'https://' + primarySelfDomain

        if (options.query) {
            if (isPojo(options.query)) {
                mockCtx.query = options.query
            } else {
                ApiError.e('INVALID_QUERY', 'Query must be a string or object.')
            }
        }

        mockCtx.method = options.method ?? 'GET'
        mockCtx.path = '/api' + (options.path[0] === '/' ? options.path : '/' + options.path)
        mockCtx.websocket = true

        let oldUser = session.userId
        await this.handleRequest(mockCtx)
        let newUser = session.userId

        if (newUser !== oldUser) {
            // login/register/logout
            if (oldUser) {
                PushService.instance.unregister(oldUser, ws.pushHandler)
            }

            if (newUser) {
                PushService.instance.register(newUser, ws.pushHandler)
            }
        }

        return mockCtx.body
    }

    send (ws: WebSocket, msg: AnyKV): void {
        return ws.send(JSON.stringify(msg))
    }

    sendError (ws: WebSocket, err: string | Error, id?: number) {
        if (typeof err === 'string') {
            err = new ApiError(err)
        }

        let obj: AnyKV = {
            ok: false,
            id
        }

        if (err instanceof ApiError) {
            obj.reason = err.code
            obj.description = err.description
        } else {
            obj.reason = 'Internal error'
        }

        if (!isProduction) {
            obj.stack = err.stack
        }

        return this.send(ws, obj)
    }
}
