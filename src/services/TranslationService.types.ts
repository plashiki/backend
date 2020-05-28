import { User } from '@/models/User'
import { Translation, TranslationKind, TranslationLanguage } from '@/models/Translation'
import { IsNumeric } from '@/helpers/validators'
import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import { FindOperator } from 'typeorm'
import { MediaType, Numeric, Paginated } from '@/types'
import { Expose } from 'class-transformer'
import { EntityField } from '@/decorators/docs'

export type TranslationQueryResult = Record<number, TranslationQuerySinglePart>

export interface TranslationQuerySinglePart {
    players: string[]
    authors: TranslationQueryAuthor[]
}

export interface TranslationQuerySingle {
    id: number
    name: string
    url: string
    hq: boolean
    uploader: User | number | null
}

export interface TranslationQueryAuthor {
    kind: TranslationKind
    name: string
    lang: TranslationLanguage
    translations: TranslationQuerySingle[]
}

export enum TranslationQueryExternalType {
    RedirectPage = 'page',
    Protocol = 'proto'
}

export class GetTranslationsParameters extends Paginated {
    @EntityField({ private: true })
    @Expose()
    @IsNumeric({ int: true })
    @IsOptional()
    id?: FindOperator<any>

    @EntityField({ private: true })
    @Expose()
    @IsNumeric({ int: true })
    @IsOptional()
    target_id?: Numeric | Numeric[] | FindOperator<any>

    @EntityField({ private: true })
    @Expose()
    @IsEnum(MediaType)
    @IsOptional()
    target_type?: MediaType

    @EntityField({ private: true })
    @Expose()
    @IsNumeric({ int: true })
    @IsOptional()
    part?: Numeric

    @EntityField({
        description: 'Kind of translations to be returned.'
    })
    @Expose()
    @IsEnum(TranslationKind)
    @IsOptional()
    kind?: TranslationKind

    @EntityField({
        description: 'Language of translations to be returned.'
    })
    @Expose()
    @IsEnum(TranslationLanguage)
    @IsOptional()
    lang?: TranslationLanguage

    @EntityField({
        description: 'If true then only HQ translations will be returned'
    })
    @Expose()
    @IsBoolean()
    @IsOptional()
    hq?: boolean

    @EntityField({
        description: 'If passed then items will not be sorted and classified, '
            + 'and returned as a raw array of objects'
    })
    @Expose()
    @IsOptional()
    raw?: boolean

    @EntityField({
        description: 'How to handle translations with external (non-embeddable) players. '
            + 'By default it will just return a link to it. <br/>'
            + 'If <code>?external=page</code>, then will return a special page that will ask user '
            + 'to open it in a new page<br/>'
            + 'If <code>?external=proto</code>, then external players will have a protocol '
            + '<code>ehttp:// or ehttps://</code>, so you can handle them manually'
    })
    @Expose()
    @IsOptional()
    @IsEnum(TranslationQueryExternalType)
    external?: TranslationQueryExternalType

    @EntityField({
        description: 'If passed, all translation object will contain a <code>uploader</code> field. '
            + 'However, only <code>id, nickname, avatar</code> fields will be available.'
    })
    @Expose()
    @IsOptional()
    needUploader?: boolean

    @EntityField({ private: true })
    @Expose()
    @IsOptional()
    renameAsAnime?: boolean
}

export type TranslationQueryResultCompat = Record<string, AnimeQueryEpisodeCompat>

export interface AnimeQueryEpisodeCompat {
    authors: Record<string, Translation>
    sources: string[]
}

export interface GetTranslationParameters {
    needUploader?: boolean
    full?: boolean
}
