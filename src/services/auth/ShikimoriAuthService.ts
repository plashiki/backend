import { OAuthResponse, ShikimoriBriefUser } from '@/external/shikimori/types'
import { AuthData } from '@/models/AuthData'
import { User } from '@/models/User'
import ShikimoriApi, { ShikimoriApiError } from '@/external/shikimori/api'
import ShikimoriAuth from '@/external/shikimori/auth'
import { AuthService } from '@/services/auth/AuthService'
import { UserService } from '@/services/UserService'
import { ApiError } from '@/types/errors'
import { ConnectableService } from '@/types/media'

export class ShikimoriAuthService extends AuthService {
    shikimori = {
        api: ShikimoriApi.instance,
        auth: ShikimoriAuth.instance
    }

    userService = new UserService()

    /**
     * Returns true if new AuthData was created
     *
     * @param userId
     * @param response
     */
    async shikimoriAuthorize (userId: number, response: OAuthResponse): Promise<boolean> {
        if (!response.scope?.match(/user_rates/)) {
            ApiError.e('INVALID_SCOPE', 'user_rates scope is not available')
        }

        const options = {
            token: response.access_token,
            refresh: response.refresh_token,
            expires: (response.created_at + response.expires_in) * 1000
        }

        const data = await AuthData.findOne({
            user_id: userId,
            service: ConnectableService.Shikimori
        })
        if (data) {
            data.options = options
            await data.save()
            return false
        } else {
            await AuthData.create({
                user_id: userId,
                service: ConnectableService.Shikimori,
                options
            }).save()
            return true
        }
    }

    async isNewShikimoriId (shikimoriId: number): Promise<boolean> {
        return this.userService.getUserByExternalId(ConnectableService.Shikimori, shikimoriId)
            .then(i => !i)
    }

    async getShikimoriIdByToken (shikimoriToken: string): Promise<number> {
        let user: ShikimoriBriefUser
        try {
            user = await this.shikimori.api.getBriefUser(shikimoriToken)
        } catch (e) {
            if (e instanceof ShikimoriApiError) {
                ApiError.e('SHIKIMORI_API_ERROR', `error code ${e.code}`)
            }
            throw e
        }

        return user.id
    }

    async connectShikimoriAccount (userId: number, shikimoriId: number): Promise<void> {
        const user = await User.findOne({ id: userId })
        if (!user) {
            ApiError.e('USER_DOESNT_EXIST')
        }

        if (user.external_ids[ConnectableService.Shikimori]) {
            ApiError.e('PLASHIKI_ACCOUNT_ALREADY_CONNECTED')
        }

        const isNew = await this.isNewShikimoriId(shikimoriId)
        if (!isNew) {
            ApiError.e('SHIKIMORI_ACCOUNT_ALREADY_CONNECTED')
        }

        user.external_ids[ConnectableService.Shikimori] = shikimoriId
        await user.save()
    }

    async connectShikimoriByToken (userId: number, shikimoriToken: string): Promise<void> {
        return this.connectShikimoriAccount(userId, await this.getShikimoriIdByToken(shikimoriToken))
    }
}
