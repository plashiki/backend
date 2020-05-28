import { Controller, Get, QueryParam } from 'routing-controllers'
import { RequireFlag } from '@/decorators/auth-decorators'
import { Endpoint } from '@/decorators/docs'
import { ApiValidationError } from '@/types'
import { StatisticsService } from '@/services/admin/StatisticsService'

@Endpoint({
    name: 'Statistics',
    description: 'Receive statistics. Requires admin rights.'
})
@RequireFlag('admin')
@Controller('/v2/admin/statistics')
export default class StatisticsController {
    service = new StatisticsService()

    @Endpoint({
        name: 'Get raw statistics',
        description: 'Retrieve raw statistic days for a given range.',
        returns: {
            type: 'StatisticsDay[]',
            description: 'For all days in a given range <b>that have statistics info</b> an item will end up there.'
                + 'Order is not guaranteed.'
        }
    })
    @Get('/')
    async getRawRange (
        @QueryParam('from') from: Date,
        @QueryParam('to') to: Date
    ) {
        if (isNaN(from as any) || isNaN(to as any)) ApiValidationError.e('Invalid date')

        return this.service.getDayRange(from, to)
    }
}
