import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { User } from './User'
import { AnyKV } from '@/types'
import { EntityConstructor, EntityField } from '@/decorators/docs'


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
export class Report extends BaseEntity {
    @EntityField({
        description: 'Unique report ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    // no relation here because well translation may get deleted
    @EntityField({
        description: 'Translation ID which is reported. Translation with this ID '
            + 'may not exist in case it was deleted after report was created. '
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
        description: 'Report comment'
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
