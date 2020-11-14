import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { User } from './User'
import { AnyKV } from '@/types/utils'
import { EntityConstructor, EntityField } from '@/decorators/docs'
import { TheEntity } from '@/helpers/typeorm-utils'


export enum ReportType {
    InvalidMedia = 'invalid_media',
    InvalidPart = 'invalid_part',
    InvalidMeta = 'invalid_meta',
    BrokenLink = 'broken_link',
    LegalIssue = 'legal_issue',
    Other = 'other'
}

export enum ReportStatus {
    Pending = 'pending',
    Resolved = 'resolved',
    Discarded = 'discarded'
}

@EntityConstructor({
    description: 'A single report.'
})
@Entity('reports')
export class Report extends TheEntity {
    @EntityField({
        description: 'Unique report ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'Whether this report is complex, meaning it affects more than one translation.'
    })
    @Column({
        default: false
    })
    is_complex: boolean

    @EntityField({
        description: 'Report target ID. For <code>is_complex=true</code>, contains ID of a media (currently supports only anime). '
            + 'For <code>is_complex=false</code>, contains ID of a translation.'
    })
    @Column()
    translation_id: number

    @EntityField({
        description: 'Report type'
    })
    @Column({
        type: 'enum',
        enum: ReportType
    })
    type: ReportType

    @EntityField({
        description: 'Report comment. Value <code>AUTO_REPORT_DESCRIPTION</code> means '
            + 'that report was created automatically in response to user trying to add duplicate '
            + 'translation with different meta'
    })
    @Column()
    comment: string

    @EntityField({
        description: 'Report sender ID'
    })
    @Column()
    sender_id: number

    @EntityField({
        description: 'Report sender object. Only available in Moderation API -> Get single report'
    })
    @ManyToOne(() => User, user => user.id)
    sender: User

    @EntityField({
        description: 'User who closed the report. Only available for closed reports, for others is null.',
    })
    @ManyToOne(() => User, user => user.id, {
        nullable: true
    })
    closed_by: User
    closed_by_id: number | null

    @Column({
        type: 'enum',
        enum: ReportStatus
    })
    status: ReportStatus

    @Column({
        type: 'json',
        nullable: true,
        default: 'null'
    })
    edit: AnyKV

    @CreateDateColumn()
    created_at: Date

    @UpdateDateColumn()
    updated_at: Date
}
