import { Body, Controller, Get, Param, QueryParams, Post, QueryParam } from 'routing-controllers'
import { MappingService } from '@/services/MappingService'
import { Endpoint } from '@/decorators/docs'
import { RequireServerScope } from '@/decorators/auth-decorators'
import { AnyKV } from '@/types/utils'
import { ApiValidationError } from '@/types/errors'
import { ExternalServiceMappings, MediaType } from '@/types/media'

@Endpoint({
    name: 'Mappings',
    description: 'Information about media ID mappings'
})
@Controller('/v2/mappings')
export default class MappingController {
    service = new MappingService()

    @Endpoint({
        name: 'Get mapping',
        description: 'Get a single media ID mapping. Query must contain 1 parameter in format: <code>?serviceName=serviceId</code>',
        params: {
            'type': {
                type: '"anime" | "manga"',
                description: 'Media type for mappings.'
            }
        },
        query: {
            '%serviceName%': {
                type: 'string | number',
                required: true,
                description: 'Media ID in given service'
            }
        },
        returns: {
            type: 'Mapping | null',
            description: 'Media mappings'
        }
    })
    @Get('/:type(anime|manga)')
    async getMapping (
        @Param('type') type: MediaType,
        @QueryParams() params: ExternalServiceMappings
    ) {
        if (Object.keys(params).length !== 1) {
            ApiValidationError.e('there should be exactly one query parameter')
        }

        return this.service.findFullMappings(type, params)
    }

    @Endpoint({
        name: 'Extend mappings',
        query: {
            force: {
                type: 'boolean',
                description: 'Whether to ignore conflicts'
            }
        },
        throws: [
            {
                type: 'CONFLICTING_MAPPING',
                description: 'There\'s a conflict when merging mappings.'
            }
        ],
        body: {
            type: 'ExternalServiceMappings'
        },
        returns: {
            type: 'Mapping'
        }
    })
    @RequireServerScope('mappings:extend')
    @Post('/extend/:type(anime|manga)')
    async extendMapping (
        @Param('type') type: MediaType,
        @QueryParam('force') force: boolean,
        @Body() body: AnyKV
    ) {
        return this.service.extendMapping(type, body, force)
    }
}
