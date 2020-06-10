import { ExternalServiceMappings, MediaType } from '@/types'
import Mapping from '@/models/Mapping'

export class MappingService {
    async findFullMappings (type: MediaType, mapping: ExternalServiceMappings): Promise<Mapping | null> {
        return Mapping.findFull(type, mapping)
    }

    async extendMapping (type: MediaType, mapping: ExternalServiceMappings, force = false): Promise<Mapping> {
        return Mapping.extend(type, mapping, force)
    }
}
