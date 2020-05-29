import { Context } from 'koa'
import { AnyKV, ApiError } from '@/types'
import { isProduction, selfDomainsRegex } from '@/config'
import redis from '@/data/redis'
import { OauthSession } from '@/models/oauth/OauthSession'
import { generateSignedToken, validateSignedToken } from '@/helpers/utils'
import { OauthApp } from '@/models/oauth/OauthApp'

const REDIS_PREFIX = 'pls-sess:'

export type SessionType = 'none' | 'oauth' | 'cookie' | 'server'

export interface ISession {
    $type: SessionType
    $token: string | null
    $shouldSave: boolean
    $shouldDestroy: boolean
    $oauth: OauthSession | null
    $app: OauthApp | null
    userId: number | null

    $save (): void

    $saveNow (): Promise<void>

    $destroy (): void

    $destroyNow (): Promise<void>

    [key: string]: any
}


export class Session implements ISession {
    $type = 'none' as SessionType
    $token: string | null = null
    $shouldSave = false
    $shouldDestroy = false
    $oauth: OauthSession | null = null
    $app: OauthApp | null = null
    userId: number | null = null

    async $saveNow (): Promise<void> {
        this.$shouldSave = false

        if (this.$type === 'none') {
            throw Error('Cannot save session without knowing session type')
        }

        if (!this.$token) {
            this.$token = generateSignedToken(this.$type + '/')
        }

        if (this.$type === 'cookie') {
            await redis.set(REDIS_PREFIX + this.$token,
                JSON.stringify(this,
                    (k, v) => k[0] === '$' ? undefined : v) // ignore props starting with $
            )
        }
        // oauth sessions are immutable by design
    }

    async $destroyNow (): Promise<void> {
        this.$shouldDestroy = false

        if (this.$token && this.$type !== 'none') {
            if (this.$type === 'oauth') {
                await OauthSession.delete({
                    token: this.$token
                })
            } else {
                await redis.del(REDIS_PREFIX + this.$token)
            }
        }
    }

    $save (): void {
        this.$shouldSave = true
    }

    $destroy (): void {
        this.$shouldDestroy = true
    }

    $import (obj?: AnyKV): void {
        if (obj) {
            for (let key of Object.keys(obj)) {
                this[key] = obj[key]
            }
        }
    }
}

export default async function sessionMiddleware (ctx: Context, next: Function): Promise<void> {
    if (ctx.session) {
        return next()
    }

    ctx.cookies.secure = isProduction

    let session = new Session()
    ctx.session = session

    let authHeader = ctx.get('Authorization')
    const origin = ctx.get('origin')

    if (authHeader) {
        let token: string | undefined = ctx.get('Authorization')?.split('Bearer ')[1]

        if (token !== undefined) {
            // token-based auth
            session.$type = 'oauth'

            if (!validateSignedToken(token, 'oauth/')) {
                ApiError.e('INVALID_TOKEN')
            }

            const oauth = await OauthSession.findOne({
                token
            })

            if (!oauth) {
                // probably session was revoked
                ApiError.e('INVALID_SESSION')
            }

            session.$oauth = oauth
            session.userId = oauth.user_id
            session.$token = token
        } else {
            let secret: string | undefined = ctx.get('Authorization')?.split('Token ')[1]
            if (secret !== undefined) {
                const app = await OauthApp.findOne({
                    where: {
                        client_secret: secret
                    },
                    select: ['server_scope', 'id']
                })

                if (!app) {
                    ApiError.e('INVALID_TOKEN')
                }

                session.$type = 'server'
                session.$app = app
            }
        }
    } else if (!origin || origin.match(selfDomainsRegex)) {
        let cookie = ctx.cookies.get('sid')

        // cookie-based auth
        session.$type = 'cookie'

        if (cookie !== undefined && validateSignedToken(cookie, 'cookie/')) {
            session.$token = cookie

            const json = await redis.get('pls-sess:' + session.$token)
            if (json) {
                const obj = JSON.parse(json)
                session.$import(obj)
            }
        }
    }

    let error
    try {
        await next()
    } catch (e) {
        error = e
    }

    if (session.$shouldDestroy && session.$token) {
        await session.$destroyNow()
        if (session.$type === 'cookie') {
            ctx.cookies.set('sid', '', {
                expires: new Date(1)
            })
        }
    } else if (session.$shouldSave) {
        if (!session.$token) {
            session.$token = generateSignedToken(session.$type + '/')
        }

        if (session.$type === 'cookie') {
            ctx.cookies.set('sid', session.$token, {
                httpOnly: true,
                maxAge: 315569260000, // 10 years, ache)
                sameSite: 'lax',
                secure: isProduction,
                signed: false // we do that ourselves
            })
        }

        await session.$saveNow()
    }

    if (error) {
        throw error
    }
}
