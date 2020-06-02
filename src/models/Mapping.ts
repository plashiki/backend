import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { ExternalServiceMappings, MediaType } from '@/types'
import { merge } from '@/helpers/object-utils'
import { EntityConstructor, EntityField } from '@/decorators/docs'

@EntityConstructor({
    description: 'A single media ID mapping'
})
@Entity('mappings')
export default class Mapping extends BaseEntity {
    @EntityField({
        description: 'Unique mapping ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'Target media type'
    })
    @Column({
        type: 'enum',
        enum: MediaType
    })
    type: MediaType

    @EntityField({
        description: 'Actual ID mappings. List of <code>ExternalService</code>s can be found in <code>src/types.ts</code> file of backend, line 60',
        fields: {
            '%ExternalService%': {
                type: 'string',
                description: 'Media ID in a given ExternalService.'
            }
        }
    })
    @Column({
        type: 'jsonb'
    })
    external: ExternalServiceMappings

    static async extend (type: MediaType, mapping: ExternalServiceMappings): Promise<void> {
        // find anything that relates
        const builder = this.createQueryBuilder()
        for (let key of Object.keys(mapping)) {
            mapping[key] = mapping[key] + '' // enforcing strings
            builder.orWhere(`external->>'${key}' = :${key}`, {
                [key]: mapping[key]
            })
        }
        const olds = await builder.getMany()
        const old = olds[0] ?? this.create({
            external: {}
        })

        // merging with others if needed
        if (olds.length > 1) {
            for (let i = 1; i < olds.length; i++) {
                const it = olds[i]
                merge(old.external, it.external)
                await it.remove()
            }
        }

        // finally mixing in given mappings
        merge(old.external, mapping)
        old.type = type
        await old.save()
    }

    static async findFull (type: MediaType, mapping: ExternalServiceMappings): Promise<Mapping | null> {
        return this.createQueryBuilder()
            .where({
                type
            })
            .andWhere('external @> :mapping', { mapping })
            .getOne()
            .then(i => i || null)
    }
}
