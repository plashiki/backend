import { User } from '@/models/User'
import { MoreThan } from 'typeorm'
import { Translation, TranslationStatus } from '@/models/Translation'
import { AuthData } from '@/models/AuthData'
import { Paginated, PaginatedResponse, PaginatedSorted } from '@/types/api'
import { ApiError } from '@/types/errors'
import { ConnectableService } from '@/types/media'

export class UserService {
    async assertNewUser (nickname: string): Promise<void> {
        const builder = User.createQueryBuilder('u')
            .where({ nickname })
        return builder.getCount()
            .then(cnt => {
                if (cnt > 0) {
                    ApiError.e('NICKNAME_CLAIMED')
                }
            })
    }

    async getUserBy<T extends keyof User> (field: T, value: User[T]): Promise<User | null> {
        return User.findOne({
            where: {
                [field]: value
            }
        }).then(i => i ?? null)
    }

    async getUserAddedCount (id: number): Promise<number> {
        return Translation.createQueryBuilder('u')
            .where({
                uploader_id: id,
                status: TranslationStatus.Added
            })
            .getCount()
    }

    async getUserById (id: number): Promise<User | null> {
        return this.getUserBy('id', id)
    }

    async getUserByIdOrThrow (id: number): Promise<User> {
        return this.getUserBy('id', id).then((user) => {
            if (!user) ApiError.e('USER_UNKNOWN')
            return user
        })
    }

    async getUserByNickname (nickname: string): Promise<User | null> {
        return this.getUserBy('nickname', nickname)
    }

    async getUserByExternalId (service: ConnectableService, id: string | number): Promise<User | null> {
        return User.createQueryBuilder('u')
            .where('u.external_ids->>\'' + service + '\' = :id', { id })
            .getOne()
            .then(it => it ?? null)
    }

    async setUserLanguage (lang: string | null, userId: number): Promise<void> {
        return User.createQueryBuilder('u')
            .update()
            .set({ language: lang })
            .where({ id: userId })
            .execute()
            .then()
    }

    async getUserLanguage (userId: number): Promise<string | null> {
        return User.findOne({
            where: {
                id: userId
            },
            select: ['language']
        }).then(i => i?.language ?? null)
    }

    async isModerator (userId: number): Promise<boolean> {
        return User.hasFlag(userId, 'moderator')
    }

    async getTopDonators (pagination: Paginated): Promise<User[]> {
        return User.createQueryBuilder('u')
            .orderBy('u.donated', 'DESC')
            .where({
                donated: MoreThan(0)
            })
            .paginate(pagination, 25)
            .getMany()
    }

    async getDonatorsFrom (ids: (number | string)[], service?: ConnectableService): Promise<User[]> {
        let builder = User.createQueryBuilder('u')
            .where('u.donated >= 300 or u.admin or u.moderator')
        if (!service) {
            builder.andWhere('u.id = any(:ids)', { ids })
        } else {
            builder.andWhere('u.external_ids->>\'' + service + '\' = any(:ids)', { ids })
        }
        return builder.getMany()
    }

    async getUsersList (pagination: PaginatedSorted): Promise<PaginatedResponse<User>> {
        return User.createQueryBuilder('u')
            .paginate(pagination, 50)
            .sort(pagination, (b) => b.orderBy('id'))
            .getManyPaginated()
    }

    async getAuthData (userId: number, service: ConnectableService): Promise<AuthData | null> {
        return AuthData.findOne({
            where: {
                user_id: userId,
                service
            }
        }).then(i => i ?? null)
    }
}
