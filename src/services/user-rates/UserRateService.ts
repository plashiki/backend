import { GetUserRatesParams } from './UserRateService.types'
import { ShikimoriUserRateDelegate } from '@/services/user-rates/shikimori'
import { User } from '@/models/User'
import { ApiError } from '@/types/errors'
import { ConnectableService, UserRate } from '@/types/media'

export interface IUserRateDelegate {
    getUserRates (userId: number, params: GetUserRatesParams): Promise<UserRate[]>

    getOneUserRate (userId: number, rateId: number, serviceUserId: string | number): Promise<UserRate | null>

    createUserRate (userId: number, params: Partial<UserRate>, serviceUserId: string | number): Promise<UserRate>

    updateUserRate (userId: number, rateId: number, params: Partial<UserRate>, serviceUserId: string | number): Promise<UserRate>

    deleteUserRate (userId: number, rateId: number, serviceUserId: string | number): Promise<void>
}

export class UserRateService {
    delegates: Record<ConnectableService, IUserRateDelegate> = {
        [ConnectableService.Shikimori]: new ShikimoriUserRateDelegate()
    }

    async getDelegate (userId: number): Promise<{
        delegate: IUserRateDelegate
        serviceUserId: string | number
    }> {
        return User.findOne({
            id: userId
        }).then((user) => {
            if (!user || !user.service || !user.external_ids[user.service]) {
                ApiError.e('UNKNOWN_USER')
            }

            return {
                delegate: this.delegates[user.service],
                serviceUserId: user.external_ids[user.service]!
            }
        })
    }

    async getUserRates (params: GetUserRatesParams): Promise<UserRate[]> {
        const userId = parseInt(params.user_id as string)
        return this.getDelegate(userId).then(({ delegate, serviceUserId }) => {
            return delegate.getUserRates(userId, {
                ...params,
                user_id: serviceUserId
            })
        })
    }

    async getOneUserRate (userId: number, rateId: number): Promise<UserRate | null> {
        return this.getDelegate(userId).then(({ delegate, serviceUserId }) => {
            return delegate.getOneUserRate(userId, rateId, serviceUserId)
        })
    }

    async createUserRate (userId: number, params: Partial<UserRate>): Promise<UserRate> {
        return this.getDelegate(userId).then(({ delegate, serviceUserId }) => {
            return delegate.createUserRate(userId, params, serviceUserId)
        })
    }

    async updateUserRate (userId: number, rateId: number, params: Partial<UserRate>): Promise<UserRate> {
        return this.getDelegate(userId).then(({ delegate, serviceUserId }) => {
            return delegate.updateUserRate(userId, rateId, params, serviceUserId)
        })
    }

    async deleteUserRate (userId: number, rateId: number): Promise<void> {
        return this.getDelegate(userId).then(({ delegate, serviceUserId }) => {
            return delegate.deleteUserRate(userId, rateId, serviceUserId)
        })
    }
}
