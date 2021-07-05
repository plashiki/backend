import { Controller, Get, QueryParam, Session } from 'routing-controllers'
import { UserService } from '@/services/UserService'
import { ISession } from '@/middlewares/01_session'
import { RequireCookie, RequireLogin } from '@/decorators/auth-decorators'
import { ApiValidationError } from '@/types/errors'
import { Endpoint } from '@/decorators/docs'

@Endpoint({
    private: true
})
@Controller('/v2/auth')
export default class AuthController {
    userService = new UserService()

    @Get('/isAvailable')
    async isAvailable (
        @QueryParam('nickname') nickname: string
    ) {
        if (!nickname) {
            ApiValidationError.e('nickname must be passed')
        }

        try {
            await this.userService.assertNewUser(nickname)
            return {
                available: true
            }
        } catch (e) {
            if (e.code === 'NICKNAME_CLAIMED') {
                return {
                    available: false
                }
            }
        }
    }

    @RequireCookie()
    @RequireLogin()
    @Get('/logout')
    logout (
        @Session() session: ISession
    ) {
        session.auth = false
        session.userId = null
        session.$save()
        return true
    }
}
