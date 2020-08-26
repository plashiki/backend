import { BaseEntity, Brackets, Column, Entity, getConnection, PrimaryGeneratedColumn } from 'typeorm'
import { ApiError, ExternalServiceMappings, MediaType } from '@/types'
import { merge } from '@/helpers/object-utils'
import { EntityConstructor, EntityField } from '@/decorators/docs'


function checkConflict (old: ExternalServiceMappings, item: ExternalServiceMappings): void {
    for (let key of Object.keys(item)) {
        if (key in old && old[key] !== item[key]) {
            ApiError.e('CONFLICTING_MAPPING')
        }
    }
}

@EntityConstructor({
    description: 'A single media ID mapping. Daily dumps (gzipped JSON) are available '
        + 'at <a href="https://plashiki.su/static/mappings.json.gz">https://plashiki.su/static/mappings.json.gz</a>'
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

    static async extend (type: MediaType, mapping: ExternalServiceMappings, force = false): Promise<Mapping> {
        return getConnection().transaction(async em => {
            await em.query('lock table mappings in exclusive mode')
            // find anything that relates
            const builder = em.getRepository(Mapping).createQueryBuilder()
            const brackets = new Brackets((qb) => {
                for (let key of Object.keys(mapping)) {
                    mapping[key] = mapping[key] + '' // enforcing strings
                    qb.orWhere(`external->>'${key}' = :${key}`, {
                        [key]: mapping[key]
                    })
                }
            })
            builder.where(brackets)
            builder.andWhere('type = :type', { type })
            const olds = await builder.getMany()
            const old = olds[0] ?? this.create({
                external: {}
            })

            // merging with others if needed
            if (olds.length > 1) {
                for (let i = 1; i < olds.length; i++) {
                    const it = olds[i]

                    if (!force) {
                        checkConflict(old.external, it.external)
                    }

                    merge(old.external, it.external)
                    await em.remove(it)
                }
            }

            if (!force) {
                checkConflict(old.external, mapping)
            }

            // finally mixing in given mappings
            merge(old.external, mapping)
            old.type = type
            return em.save(old)
        })
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
