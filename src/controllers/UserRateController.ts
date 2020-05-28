import { Body, Controller, Delete, Get, Param, Post, QueryParams, Session } from 'routing-controllers'
import { RequireLogin } from '@/decorators/auth-decorators'
import { ISession } from '@/middlewares/01_session'
import { UserRate } from '@/types'
import { UserRateService } from '@/services/user-rates/UserRateService'
import { GetUserRatesParams } from '@/services/user-rates/UserRateService.types'
import { PartialBody } from '@/helpers/api-validate'
import { Endpoint } from '@/decorators/docs'

@Endpoint({
    name: 'User rates',
    description: 'User rates (aka user lists) related endpoints. Note that we do not store any user rates. '
        + 'Instead, we proxy them to selected user\'s provider and normalize into universal UserRate object.'
})
@RequireLogin()
@Controller('/v2/user_rates')
export default class UserRateController {
    userRateService = new UserRateService()

    @Endpoint({
        name: 'Get user rates',
        description: 'Get user rates by parameters. Overall logic is common, but results may vary between providers',
        query: {
            $extends: 'GetUserRatesParams'
        },
        returns: {
            type: 'UserRate[]'
        }
    })
    @Get('/')
    getRates (
        @QueryParams() params: GetUserRatesParams,
        @Session() session: ISession
    ) {
        if (params.user_id === undefined) {
            params.user_id = session.userId!
        }
        return this.userRateService.getUserRates(params)
    }

    @Endpoint({
        name: 'Get single user rate',
        description: 'Get user rate by ID. ID format may vary between providers',
        params: {
            rateId: {
                type: 'number',
                description: 'User rate ID'
            }
        },
        returns: {
            type: 'UserRate'
        }
    })
    @Get('/:rateId')
    getSingleRate (
        @Param('rateId') rateId: number,
        @Session() session: ISession
    ) {
        return this.userRateService.getOneUserRate(session.userId!, rateId)
    }

    @Endpoint({
        name: 'Create a user rate',
        description: 'Create user rate by common params.',
        body: {
            type: 'UserRate',
            partial: true
        },
        returns: {
            type: 'UserRate'
        }
    })
    @Post('/')
    createUserRate (
        @Session() session: ISession,
        @Body(PartialBody) userRate: Partial<UserRate>
    ) {
        return this.userRateService.createUserRate(session.userId!, userRate)
    }

    @Endpoint({
        name: 'Update a user rate',
        description: 'Update user rate.',
        body: {
            type: 'UserRate',
            partial: true
        },
        params: {
            rateId: {
                type: 'number',
                description: 'User rate ID'
            }
        },
        returns: {
            type: 'UserRate'
        }
    })
    @Post('/:rateId')
    updateUserRate (
        @Param('rateId') rateId: number,
        @Session() session: ISession,
        @Body(PartialBody) userRate: Partial<UserRate>
    ) {
        return this.userRateService.updateUserRate(session.userId!, rateId, userRate)
    }

    @Endpoint({
        name: 'Delete a user rate',
        description: 'Delete a single user rate. Actual action may vary between providers.',
        params: {
            rateId: {
                type: 'number',
                description: 'User rate ID'
            }
        },
        returns: {
            type: '"OK"'
        }
    })
    @Delete('/:rateId')
    deleteUserRate (
        @Param('rateId') rateId: number,
        @Session() session: ISession
    ) {
        return this.userRateService.deleteUserRate(session.userId!, rateId)
            .then(() => 'OK')
    }
}
