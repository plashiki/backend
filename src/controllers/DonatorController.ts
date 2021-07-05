import { Controller, Get, QueryParam, QueryParams } from 'routing-controllers'
import { Endpoint } from '@/decorators/docs'
import { UserService } from '@/services/UserService'
import { Paginated } from '@/types/api'
import { ConnectableService } from '@/types/media'

@Endpoint({
    name: 'Donators',
    description: 'Fetch information about users who supported the project'
})
@Controller('/v2/donators')
export default class DonatorController {
    userService = new UserService()

    @Endpoint({
        name: 'Top donators',
        description: 'Returns list of donators, sorted by donation amount (desc)',
        query: {
            $extends: 'Paginated'
        },
        returns: {
            type: 'User[]'
        }
    })
    @Get('/top')
    async getTopDonators (
        @QueryParams() pagination: Paginated
    ) {
        return this.userService.getTopDonators(pagination)
    }

    @Endpoint({
        name: 'Donators from',
        description: 'Returns list of donators, whose id is one of given. '
            + 'Useful for displaying donation badges in UI',
        query: {
            ids: {
                type: 'number[]',
                required: true,
                description: 'List of comma-delimited IDs from which to find donators. Maximum 100.'
            },
            service: {
                type: 'ConnectableService',
                description: 'If passed, list of ids will be treated as external ids.'
            }
        },
        returns: {
            type: 'User[]'
        }
    })
    @Get('/from')
    async getDonatorsFromList (
        @QueryParam('ids') idsString: string,
        @QueryParam('service') service?: ConnectableService
    ) {
        let ids: (string | number)[] = idsString.split(',')

        if (!service) {
            ids = ids.map(i => parseInt(i as string)).filter(i => !isNaN(i))
        }

        if (ids.length > 100) ids.length = 100

        return this.userService.getDonatorsFrom(ids, service)
    }
}
