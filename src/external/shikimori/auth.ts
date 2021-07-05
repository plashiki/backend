import { shikimori } from '@/config'
import fetchRetry from '@/helpers/fetch-retry'
import * as qs from 'querystring'
import { OAuthResponse } from './types'
import { ApiError } from '@/types/errors'

export default class ShikimoriAuth {
    private static __instance?: ShikimoriAuth

    private constructor () {
        // noop //
    }

    static get instance (): ShikimoriAuth {
        if (!ShikimoriAuth.__instance) {
            ShikimoriAuth.__instance = new ShikimoriAuth()
        }
        return ShikimoriAuth.__instance!
    }


    async authenticate (oauthCode: string): Promise<OAuthResponse> {
        return fetchRetry('https://shikimori.one/oauth/token', {
            timeout: 30000,
            method: 'POST',
            headers: {
                'User-Agent': shikimori.appName,
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: qs.stringify({
                grant_type: 'authorization_code',
                client_id: shikimori.clientId,
                client_secret: shikimori.clientSecret,
                redirect_uri: shikimori.redirectUri,
                code: oauthCode
            })
        }).then(i => i.json()).then((res: OAuthResponse) => {
            if (!res.access_token) {
                ApiError.e('INVALID_AUTH_CODE')
            }

            return res
        })
    }

    async refresh (refreshToken: string): Promise<OAuthResponse> {
        return fetchRetry('https://shikimori.one/oauth/token', {
            timeout: 30000,
            method: 'POST',
            headers: {
                'User-Agent': 'PlaShiki',
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: qs.stringify({
                grant_type: 'refresh_token',
                client_id: shikimori.clientId,
                client_secret: shikimori.clientSecret,
                refresh_token: refreshToken
            })
        }).then(i => i.json())
    }
}
