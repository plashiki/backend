import {
    ShikimoriApiCallParams,
    ShikimoriBriefMedia,
    ShikimoriBriefUser,
    ShikimoriUser,
    ShikimoriUserRate
} from './types'
import * as qs from 'querystring'
import fetchRetry from '@/helpers/fetch-retry'
import { isProduction, shikimori } from '@/config'
import { AnyKV, ApiError, ConnectableService, MediaType } from '@/types'
import { isPojo } from '@/helpers/object-utils'
import _debug from 'debug'
import { AuthData } from '@/models/AuthData'
import ShikimoriAuth from '@/external/shikimori/auth'

const debug = _debug('shiki-api')

export class ShikimoriApiError extends ApiError {
    constructor (code: number | string, message?: string) {
        super('SHIKIMORI_ERROR', `${code}:${message ?? ''}`)
    }
}

export default class ShikimoriApi {
    private static __instance?: ShikimoriApi

    private constructor () {
        // noop //
    }

    static get instance (): ShikimoriApi {
        if (!ShikimoriApi.__instance) {
            ShikimoriApi.__instance = new ShikimoriApi()
        }
        return ShikimoriApi.__instance!
    }

    async shikimoriApi<T> (
        params: ShikimoriApiCallParams
    ): Promise<T> {
        let url = params.api === false ? shikimori.endpoint : shikimori.apiEndpoint

        if (typeof params.endpoint === 'function') {
            url += params.endpoint(params.params)
        } else {
            url += params.endpoint
        }

        // __=/autocomplete is a ratelimit bypass xdd
        // https://github.com/shikimori/shikimori/blob/master/config/initializers/rack-attack.rb#L31
        // morr plz leave this as a feature, lol

        if (params.query) {
            url += '?' + qs.stringify(params.query) + '&__/autocomplete'
        } else {
            url += '?__/autocomplete'
        }

        const headers: AnyKV = {
            // 'Anime 365 (https://smotretanime.ru/; info@smotretanime.ru)'
            // ^^ this UA is an edge case which has higher ratelimit.
            'User-Agent': shikimori.appName,
            accept: 'application/json'
        }

        if (params.asUser) {
            const auth = await AuthData.findOne({
                user_id: params.asUser,
                service: ConnectableService.Shikimori
            })

            if (!auth) throw new ShikimoriApiError('no auth for given user')

            const { options } = auth
            if (Date.now() > options.expires!) {
                const rsp = await ShikimoriAuth.instance.refresh(options.refresh!)
                options.expires = (rsp.created_at + rsp.expires_in) * 1000
                options.refresh = rsp.refresh_token
                options.token = rsp.access_token
                await auth.save()
            }

            params.token = options.token
        }

        if (params.token) {
            headers.Authorization = 'Bearer ' + params.token
        }

        if (params.body && params.body !== 'string') {
            headers['Content-Type'] = 'application/json'
            params.body = JSON.stringify(params.body)
        }

        let dbg = ''
        if (!isProduction) {
            // json.stringify is quite expensive

            dbg = `${params.httpMethod ?? 'GET'}${
                params.asUser ? ' ** as id' + params.asUser + ' **' : ''} ${url} ${params.body || '%empty body%'}`
            debug(dbg)
        }

        let r = await fetchRetry(url, {
            method: params.httpMethod ?? 'GET',
            headers,
            timeout: 30000,
            body: params.body as (string | undefined),
            validator: r => r.status !== 429 || 'RATE_LIMIT',
            sleep: 600
        }).then(i => i.text()).then(i => {
            if (!isProduction) {
                debug(dbg + '\n' + i)
            }
            return i
        })

        // very uniform api, much handle

        if (r === '') return null as any
        try {
            r = JSON.parse(r)
        } catch (e) {
            throw new ShikimoriApiError(r)
        }

        if (Array.isArray(r) && typeof r[0] === 'string') {
            throw new ShikimoriApiError(r[0])
        }

        if (isPojo(r)) {
            if ('code' in r && 'message' in r) {
                throw new ShikimoriApiError(r.code, r.message)
            }

            if ('error' in r) {
                throw new ShikimoriApiError(r.error, r.error_description)
            }
        }

        return r as any
    }

    async getBriefUser (token: string): Promise<ShikimoriBriefUser> {
        return this.shikimoriApi<ShikimoriBriefUser>({
            endpoint: '/users/whoami',
            token
        }).then(i => {
            if (!i) throw new ShikimoriApiError('invalid_token', 'Token provided seems to be invalid')
            return i
        })
    }

    async getUser (slug: number | string, token?: string): Promise<ShikimoriUser | null> {
        const endpoint = '/users/' + encodeURIComponent(slug)
        const query: AnyKV = {}
        if (typeof slug === 'string') {
            query.is_nickname = 1
        }
        try {
            return await this.shikimoriApi<ShikimoriUser>({
                endpoint,
                query,
                token
            })
        } catch (e) {
            if (e instanceof ShikimoriApiError && e.code.startsWith('404:')) {
                return null
            }
            throw e
        }
    }

    getUserRate (userId: number, rateId: number): Promise<ShikimoriUserRate | null> {
        return this.shikimoriApi({
            endpoint: '/v2/user_rates/' + rateId,
            asUser: userId
        })
    }

    getUserRates (userId: number, shikimoriUserId: number, params: AnyKV = {}): Promise<ShikimoriUserRate[]> {
        return this.shikimoriApi<ShikimoriUserRate[]>({
            endpoint: '/v2/user_rates',
            query: {
                ...params,
                user_id: shikimoriUserId
            },
            asUser: userId
        })
    }

    createUserRate (userId: number, params: Partial<ShikimoriUserRate>): Promise<ShikimoriUserRate> {
        return this.shikimoriApi({
            endpoint: '/v2/user_rates',
            query: {
                user_id: params.user_id
            },
            httpMethod: 'POST',
            body: {
                user_rate: params
            },
            asUser: userId
        })
    }

    updateUserRate (userId: number, rateId: number, params: Partial<ShikimoriUserRate>): Promise<ShikimoriUserRate> {
        return this.shikimoriApi<ShikimoriUserRate>({
            endpoint: '/v2/user_rates/' + rateId,
            query: {
                user_id: params.user_id
            },
            httpMethod: 'PATCH',
            body: {
                user_rate: params
            },
            asUser: userId
        })
    }

    deleteUserRateById (userId: number, id: number): Promise<void> {
        return this.shikimoriApi({
            endpoint: '/v2/user_rates/' + id,
            httpMethod: 'DELETE',
            asUser: userId
        })
    }

    getBriefMedia (type: MediaType, mediaId: number[]): Promise<ShikimoriBriefMedia[]> {
        if (type === 'anime') {
            return this.shikimoriApi({
                endpoint: '/animes',
                query: {
                    ids: mediaId.join(',')
                }
            })
        } else {
            let proms = [
                this.shikimoriApi<ShikimoriBriefMedia[]>({
                    endpoint: '/mangas',
                    query: {
                        ids: mediaId.join(',')
                    }
                }),
                this.shikimoriApi<ShikimoriBriefMedia[]>({
                    endpoint: '/ranobe',
                    query: {
                        ids: mediaId.join(',')
                    }
                })
            ]
            return Promise.all(proms).then(([r1, r2]) => [...r1, ...r2])
        }
    }
}
