import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm'
import { User } from './User'
import { IsUrl } from 'class-validator'
import { MediaType } from '@/types'
import { EntityConstructor, EntityField } from '@/decorators/docs'

export enum TranslationKind {
    // for anime
    Subtitles = 'sub',
    Dubbed = 'dub',

    // for manga/ranobe
    Scanlation = 'scan',
    Official = 'off',

    // common
    Original = 'raw'
}

export enum TranslationLanguage {
    English = 'en',
    Russian = 'ru',
    Belorussian = 'by',
    Ukrainian = 'ua',
    Japanese = 'jp',
    French = 'fr',
    German = 'de',
    Chinese = 'cn',
    Korean = 'ko',

    Other = 'other'
}

export enum TranslationStatus {
    Pending = 'pending',
    Added = 'added',
    Declined = 'declined'
}

@EntityConstructor({
    description: 'A single translation/submission (technically they are the same)'
})
@Entity('translations')
@Index(['target_type', 'target_id', 'part'])
export class Translation extends BaseEntity {
    @EntityField({
        description: 'Unique translation/submission ID.'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'Target media ID of the translation. Currently uses MAL IDs.'
    })
    @Column()
    target_id: number

    @EntityField({
        description: 'Target media type of the translation. Currently uses <code>anime, manga</code> like MAL.'
    })
    @Column({
        type: 'enum',
        enum: MediaType
    })
    target_type: MediaType

    @EntityField({
        description: 'Part number of the translation. Specifically, episode for anime and chapter for manga.'
    })
    @Column()
    part: number

    @EntityField({
        description: 'Translation kind. Anime translation can be <code>sub</code>bed and <code>dub</code>bed, '
            + 'manga translations can be <code>scan</code>lations and <code>off</code>ficial, and both can be <code>raw</code>'
    })
    @Column({
        type: 'enum',
        enum: TranslationKind
    })
    kind: TranslationKind

    @EntityField({
        description: 'Translation language. Currently support <code>en, ru, by, ua, jp, fr, de, cn, ko</code> and <code>other</code>, but list may expand at some time.'
    })
    @Column({
        type: 'enum',
        enum: TranslationLanguage
    })
    lang: TranslationLanguage

    @EntityField({
        description: 'Whether the translation is HQ (exact definition may vary, '
            + 'but usually it means 720p or more for anime and hi-res scans for manga)'
    })
    @Column()
    hq: boolean

    @EntityField({
        description: 'Translation author. Can contain studio name (like <code>AniDUB</code>), author names (like <code>Anku, mutagenb</code>), '
            + 'both (like <code>AniDUB (Anku, mutagenb)</code>) or basically anything else that can be used to describe an author. '
            + 'There\'s no strict format. Edge case is an empty <code>author</code>, which should be interpreted as Unknown author.'
    })
    @Column()
    author: string

    @EntityField({
        description: 'ID of user that added this translation. '
            + '<code>null</code> if added by Parser or External batch addition'
    })
    @Column({
        nullable: true
    })
    @Index()
    uploader_id: number

    @EntityField({
        description: 'Information about user that added this translation. Only present with <code>?needUploader</code> param,'
            + ' only <code>id, nickname, avatar</code> fields are present.'
    })
    @ManyToOne(() => User, user => user.id)
    uploader: User | null

    @EntityField({
        description: 'Translation status. Differentiates submissions and actual translations. Only available in Moderation or Submission APIs.'
    })
    @Column({
        type: 'enum',
        enum: TranslationStatus,
        select: false
    })
    @Index()
    status: TranslationStatus

    @EntityField({
        description: 'URL to translation iframe. Is a <code>https://</code> link '
            + '(or <code>http://</code> for external translations). If <code>?external=proto</code>, '
            + 'then may be a <code>ehttp://</code> or <code>ehttps://</code> link, which means this translation '
            + 'is external and can\'t be displayed in a iframe. Remove preceding e to get actual link.'
    })
    @Column({ unique: true })
    @IsUrl({
        protocols: ['https']
    })
    url: string

    @EntityField({
        description: 'Translation grouping. Used to do batch operations with ease. '
            + 'Mainly used for Parsers like <code>parser:[parser-uid]</code> and '
            + 'External batch addition like <code>from-app:[app-id]</code>'
            + 'Only visible to moderators.'
    })
    @Column({
        type: 'text',
        array: true,
        default: '{}',
        select: false
    })
    groups: string[]

    @EntityField({
        description: 'Translation creation time'
    })
    @CreateDateColumn()
    created_at: Date

    @EntityField({
        description: 'Translation last update time'
    })
    @UpdateDateColumn()
    @Index()
    updated_at: Date
}
