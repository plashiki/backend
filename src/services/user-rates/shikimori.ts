import { IUserRateDelegate } from './UserRateService'
import { AnyKV, MediaType, Paginated, UserRate } from '@/types'
import { GetUserRatesParams } from './UserRateService.types'
import ShikimoriApi from '@/external/shikimori/api'
import {
    ShikimoriToUserRateStatusAdapter,
    ShikimoriUserRate,
    UserRateToShikimoriStatusAdapter
} from '@/external/shikimori/types'

export class ShikimoriUserRateDelegate implements IUserRateDelegate {
    shikimoriApi = ShikimoriApi.instance

    private static __adapter (s: ShikimoriUserRate): UserRate {
        return {
            id: s.id,
            target_id: s.target_id,
            target_type: s.target_type.toLowerCase() as MediaType,
            status: ShikimoriToUserRateStatusAdapter[s.status],
            parts: s.target_type === 'Anime' ? s.episodes : s.chapters,
            partsVolumes: s.target_type === 'Manga' ? s.volumes : undefined,
            repeats: s.rewatches,
            created_at: s.created_at,
            updated_at: s.updated_at,
            score: s.score === 0 ? null : s.score
        }
    }

    private static __adapterTo (s: Partial<UserRate> & Paginated, rewatching = false): AnyKV {
        let res: AnyKV = {}

        res.user_id = s.user_id

        if (s.limit) {
            res.limit = s.limit
        }

        if (s.offset) {
            // usually offset is a multiple of limit. if not then well idk whats wrong with client
            res.page = ~~(parseInt(s.offset as string) / parseInt(s.limit as string))
        }

        if (s.status) {
            res.status = UserRateToShikimoriStatusAdapter[s.status]
            if (res.status === 'watching' && rewatching) {
                res.status = 'watching,rewatching'
            }
        }

        if (s.target_type) {
            res.target_type = s.target_type === 'anime' ? 'Anime' : 'Manga'
        }

        if (s.target_id) {
            res.target_id = s.target_id
        }

        if (s.score !== undefined) {
            res.score = s.score === null ? 0 : s.score
        }

        if (s.repeats !== undefined) {
            res.rewatches = s.repeats
        }

        if (s.target_type && s.parts !== undefined) {
            res[s.target_type === 'anime' ? 'episodes' : 'chapters'] = s.parts
        }

        if (s.partsVolumes !== undefined) {
            res.volumes = s.partsVolumes
        }

        return res
    }

    getUserRates (userId: number, params: GetUserRatesParams): Promise<UserRate[]> {
        return this.shikimoriApi.getUserRates(userId, params.user_id as number, ShikimoriUserRateDelegate.__adapterTo(params, true))
            .then((shikiUserRates) => shikiUserRates.map(ShikimoriUserRateDelegate.__adapter))

    }

    createUserRate (userId: number, params: Partial<UserRate>, serviceUserId: string | number): Promise<UserRate> {
        params.user_id = serviceUserId
        return this.shikimoriApi.createUserRate(userId, ShikimoriUserRateDelegate.__adapterTo(params))
            .then(ShikimoriUserRateDelegate.__adapter)
    }

    getOneUserRate (userId: number, rateId: number): Promise<UserRate | null> {
        return this.shikimoriApi.getUserRate(userId, rateId).then(ShikimoriUserRateDelegate.__adapter)
    }

    deleteUserRate (userId: number, rateId: number): Promise<void> {
        return this.shikimoriApi.deleteUserRateById(userId, rateId)
    }

    updateUserRate (userId: number, rateId: number, params: Partial<UserRate>, serviceUserId: string | number): Promise<UserRate> {
        params.user_id = serviceUserId
        return this.shikimoriApi.updateUserRate(userId, rateId, ShikimoriUserRateDelegate.__adapterTo(params))
            .then(ShikimoriUserRateDelegate.__adapter)
    }

}
