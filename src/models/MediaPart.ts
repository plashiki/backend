import { EntityConstructor, EntityField } from '@/decorators/docs'
import { MediaType } from '@/types/media'
import { Column, PrimaryGeneratedColumn, Entity, Index } from 'typeorm'
import { generateOnConflictStatement } from '@/helpers/utils'
import { TheEntity } from '@/helpers/typeorm-utils'

@EntityConstructor({
    description: 'A single media part\'s information'
})
@Entity('media_parts')
@Index(['media_type', 'media_id', 'number'], { unique: true })
export default class MediaPart extends TheEntity {
    static ON_CONFLICT = generateOnConflictStatement(['media_type', 'media_id', 'number'], ['title'])

    @EntityField({
        description: 'Unique part ID'
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
    media_type: MediaType

    @EntityField({
        description: 'Target media ID (MAL)'
    })
    @Column()
    media_id: number

    @EntityField({
        description: 'Part number (starting from 1)'
    })
    @Column()
    number: number

    @EntityField({
        description: 'Part title'
    })
    @Column()
    title: string

    static async add (part: Partial<MediaPart>, update = false): Promise<void> {
        await this.createQueryBuilder('m')
            .insert()
            .values(part)
            .onConflict(update ? this.ON_CONFLICT : 'do nothing')
            .execute()
    }
}
