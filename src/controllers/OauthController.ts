import { BodyParam, Controller, Ctx, Get, Post, QueryParam, Session } from 'routing-controllers'
import { RequireCookie } from '@/decorators/auth-decorators'
import { ApiError, ApiValidationError } from '@/types'
import { ISession } from '@/middlewares/01_session'
import { StatisticsQueue } from '@/data/queues'
import { templateFile } from '@/helpers/templating'
import RawResponse from '@/decorators/raw-response'
import { createCommonSign, createNonce } from '@/helpers/utils'
import { Context } from 'koa'
import redirect from '@/middlewares/redirect'
import { primarySelfDomain } from '@/config'
import { Endpoint } from '@/decorators/docs'
import { ApplicationsService } from '@/services/ApplicationsService'

@Endpoint({
    name: 'OAuth',
    description: 'Not exactly OAuth, we have much more simple and straightforward flow similar to OAuth, so let\'s call it OAuth. More in OAuth section'
})
@Controller('/v2/oauth')
export default class OauthController {
    service = new ApplicationsService()

    @Endpoint({
        name: 'Start implicit flow',
        description: 'This endpoint returns a plain HTML page containing form where user will accept or decline grant.',
        params: {
            client_id: {
                type: 'string',
                required: true,
                description: 'Client ID to which the token should be issued.'
            }
        },
        throws: [
            {
                type: 'NO_SUCH_APP',
                description: 'Provided client_id string is not associated with any app'
            }
        ]
    })
    @Get('/authorize')
    @RequireCookie()
    @RawResponse()
    async startImplicitFlow (
        @Session() session: ISession,
        @Ctx() ctx: Context,
        @QueryParam('client_id') client_id?: string
    ) {
        if (!client_id) {
            ApiValidationError.e('client_id is not supplied')
        }

        if (!session.auth) {
            const target = `//${primarySelfDomain}/auth?then=${encodeURIComponent(ctx.originalUrl)}`
            return redirect(ctx, target)
        }

        const app = await this.service.getApp({ client_id }, true)

        if (!app) {
            ApiError.e('NO_SUCH_APP', 'Provided client_id string is not associated with any app.')
        }

        const nonce = createNonce()

        return templateFile('oauth.hbs', {
            appIcon: app.icon || '/img/image_fallback.jpg',
            appName: app.name,
            clientId: client_id,
            userId: session.userId,
            nonce,
            acceptHash: createCommonSign(`oauth:accept/${app.client_id}/${session.userId}#${nonce}`)
        })
    }

    @Endpoint({
        private: true
    })
    @Post('/authorize')
    @RequireCookie()
    @RawResponse()
    async finishImplicitFlow (
        @Session() session: ISession,
        @Ctx() ctx: Context,
        @BodyParam('client_id') client_id?: string,
        @BodyParam('user_id') userId?: number,
        @BodyParam('nonce') nonce?: string,
        @BodyParam('action') action?: string
    ) {
        if (!client_id || !userId || !nonce || !action) {
            ApiValidationError.e('something is not supplied') // idc
        }

        if (userId !== session.userId) {
            ApiError.e('INVALID_USER', 'This grant was issued to another user.')
        }

        const app = await this.service.getApp({ client_id }, true)
        if (!app) {
            ApiError.e('NO_SUCH_APP', 'Provided client_id string is not associated with any app.')
        }

        if (action === 'decline') {
            return redirect(ctx, app.redirect_uri + '?ok=0&reason=declined')
        }

        const validHash = createCommonSign(`oauth:accept/${app.client_id}/${userId}#${nonce}`)

        if (action !== validHash) {
            ApiError.e('INVALID_GRANT', 'Provided action is not a valid grant.')
        }

        const oauthSession = await this.service.createSession(app.id, session.userId!)

        StatisticsQueue.add('stat-event', {
            name: 'new-oauth'
        })

        return redirect(ctx, app.redirect_uri + '?ok=1&token=' + encodeURIComponent(oauthSession.token))
    }
}
