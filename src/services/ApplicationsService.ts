import { OauthApp } from '@/models/oauth/OauthApp'
import { Paginated } from '@/types'
import { createNonce, generateSignedToken } from '@/helpers/utils'
import { OauthSession } from '@/models/oauth/OauthSession'

export class ApplicationsService {
    getApplications (pagination: Paginated, userId?: number): Promise<OauthApp[]> {
        let builder = OauthApp.createQueryBuilder('a')
        if (userId !== undefined) {
            builder.where({
                owner_id: userId
            })
        } else {
            builder
                .leftJoin('a.owner', 'o')
                .addSelect(['o.id', 'o.nickname', 'o.avatar'])
        }

        builder.paginate(pagination, 15)
        return builder.getMany()
    }

    createApplication (params: Partial<OauthApp>, ownerId: number): Promise<OauthApp> {
        const client_id = createNonce()

        return OauthApp.create({
            ...params,
            client_id,
            // using client_id as secret salt
            // it won't be validated anywhere,
            // so using it as a random seed actually
            client_secret: generateSignedToken(client_id),
            owner_id: ownerId
        }).save()
    }

    getApplication (id: number, full = false): Promise<OauthApp | null> {
        const builder = OauthApp.createQueryBuilder()
            .where({ id })

        if (full) {
            builder.addSelectHidden()
        }

        return builder.getOne()
            .then(i => i ?? null)
    }

    revoke (app: OauthApp, field: 'id' | 'secret' | 'both'): Promise<OauthApp> {
        if (field === 'both' || field === 'id') {
            app.client_id = createNonce()
        }
        if (field === 'both' || field === 'secret') {
            app.client_secret = generateSignedToken(app.client_id)
        }
        return app.save()
    }

    getAuthedApplications (userId: number): Promise<OauthApp[]> {
        return OauthSession.createQueryBuilder('s')
            .distinctOn(['s.app_id'])
            .where({
                user_id: userId
            })
            .leftJoinAndSelect('s.app', 'a')
            .leftJoin('a.owner', 'o')
            .addSelect(['o.id', 'o.nickname', 'o.avatar'])
            .getMany()
            .then((sessions) => sessions.map(i => i.app))
    }

    getApp (params: Partial<OauthApp>, full = false): Promise<OauthApp | undefined> {
        const builder = OauthApp.createQueryBuilder().where(params)

        if (full) {
            builder.addSelectHidden()
        }

        return builder.getOne()
    }

    createSession (appId: number, userId: number): Promise<OauthSession> {
        return OauthSession.create({
            app_id: appId,
            user_id: userId,
            token: generateSignedToken('oauth/')
        }).save()
    }

    revokeAuthorization (appId: number, userId: number): Promise<true> {
        return OauthSession.delete({
            app_id: appId,
            user_id: userId
        }).then(() => true)
    }

    revokeAllActiveSessions (appId: number): Promise<true> {
        return OauthSession.delete({
            app_id: appId
        }).then(() => true)
    }
}
