import { RequireLogin } from '@/decorators/auth-decorators'
import { Body, Controller, Post, Session } from 'routing-controllers'
import { ISession } from '@/middlewares/01_session'
import { Expose } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'
import { ShikimoriAuthService } from '@/services/auth/ShikimoriAuthService'
import RateLimit from '@/decorators/rate-limit'
import { StatisticsQueue } from '@/data/queues'
import { UserService } from '@/services/UserService'
import { IsPojo } from '@/helpers/validators'
import { Endpoint } from '@/decorators/docs'
import { User } from '@/models/User'
import { AnyKV } from '@/types/utils'
import { ApiError } from '@/types/errors'
import { ConnectableService } from '@/types/media'


class ShikimoriLoginBody {
    @Expose()
    @IsString()
    code: string

    @Expose()
    @IsOptional()
    @IsString()
    nickname: string
}

class ShikimoriProxyBody {
    @Expose()
    @IsString()
    endpoint: string

    @Expose()
    @IsString()
    @IsOptional()
    httpMethod?: string

    @Expose()
    @IsPojo()
    @IsOptional()
    params?: AnyKV

    @Expose()
    @IsPojo()
    @IsOptional()
    query?: AnyKV

    @Expose()
    @IsPojo()
    @IsOptional()
    body?: AnyKV

    @Expose()
    @IsBoolean()
    @IsOptional()
    api?: false
}

@Endpoint({
    private: true
})
@Controller('/v2/auth')
export default class ShikimoriAuthController {
    authService = new ShikimoriAuthService()
    userService = new UserService()

    @RateLimit(10, 180, 'login-shiki/')
    @Post('/login/shikimori')
    async loginViaShikimori (
        @Body() body: ShikimoriLoginBody,
        @Session() session: ISession
    ) {
        const response = session.tmpShikiOauth ?? await this.authService.shikimori.auth.authenticate(body.code)
        const shikimoriUser = await this.authService.shikimori.api.getBriefUser(response.access_token)

        let isNew
        let user: User | null
        if (session.userId) {
            // user wants to create new connection
            user = await this.userService.getUserById(session.userId)
            if (!user) ApiError.e('INVALID_SESSION')

            isNew = false

            user.external_ids[ConnectableService.Shikimori] = shikimoriUser.id
            await user.save()
        } else {
            // login/registration via service
            user = await this.userService.getUserByExternalId(ConnectableService.Shikimori, shikimoriUser.id)
            isNew = !user
            if (!user) {
                if (!body.nickname) {
                    session.tmpShikiOauth = response
                    session.$save()

                    return {
                        state: 'NEED_NICKNAME',
                        default: shikimoriUser.nickname
                    }
                } else {
                    await this.userService.assertNewUser(body.nickname)
                }

                user = await this.authService.registerUser({
                    nickname: body.nickname,
                    external_ids: {
                        [ConnectableService.Shikimori]: shikimoriUser.id
                    },
                    service: ConnectableService.Shikimori,
                    avatar: shikimoriUser.image.x160
                })

            }

            session.tmpShikiOauth = undefined

            session.auth = true
            session.userId = user.id
            session.$save()
        }

        await this.authService.shikimoriAuthorize(user.id, response)

        StatisticsQueue.add('stat-event', {
            name: isNew ? 'registration' : 'login',
            source: ':shikimori'
        })

        return {
            state: 'OK',
            user: user!.stripHidden()
        }
    }

    @RequireLogin()
    @Post('/connect/shikimori')
    async connectShikimori (
        @Body() body: ShikimoriLoginBody,
        @Session() session: ISession
    ) {
        const response = await this.authService.shikimori.auth.authenticate(body.code)

        await this.authService.connectShikimoriByToken(session.userId!, response.access_token)
        await this.authService.shikimoriAuthorize(session.userId!, response)

        return true
    }

    @RequireLogin()
    @Post('/proxy/shikimori')
    async proxyShikimoriApi (
        @Body() body: ShikimoriProxyBody,
        @Session() session: ISession
    ) {
        return this.authService.shikimori.api.shikimoriApi({
            ...body,
            asUser: session.userId!
        })
    }

}
