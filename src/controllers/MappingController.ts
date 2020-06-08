import { Body, Controller, Get, Param, QueryParams, Post } from 'routing-controllers'
import { AnyKV, ApiValidationError, ExternalServiceMappings, MediaType } from '@/types'
import { MappingService } from '@/services/MappingService'
import { Endpoint } from '@/decorators/docs'
import { RequireServerScope } from '@/decorators/auth-decorators'

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
        @Body() body: AnyKV
    ) {
        return this.service.extendMapping(type, body)
    }
}
