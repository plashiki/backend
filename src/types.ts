import { ISession } from './middlewares/01_session'
import { IsNumeric } from '@/helpers/validators'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { Expose } from 'class-transformer'
import { EntityConstructor } from '@/decorators/docs'


export type StringKV = Record<string, string>
export type AnyKV = Record<string, any>
export type Constructor<T = any, P extends Array<any> = any[]> = new (...args: P) => T
export type OptionalRecord<K extends keyof any, T> = {
    [P in K]?: T;
};

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>
export type Numeric = string | number


export function numericToNumber (i: Numeric | undefined): number {
    if (i === undefined) return NaN
    return typeof i === 'string' ? parseInt(i) : i
}

export class ApiError extends Error {
    static UnknownMethod = new ApiError('Unknown method')
    static TooManyRequests = new ApiError('Too many requests')
    static CaptchaNeeded = new ApiError('CAPTCHA', 'Action confirmation required')
    public code: string
    public description?: string

    constructor (code: string, description?: string) {
        super(`API Error: ${code}`)

        this.code = code
        this.description = description
    }

    // shorthand
    static e (code: string, description?: string): never {
        throw new ApiError(code, description)
    }
}

export class ApiValidationError extends ApiError {
    constructor (errors: string | string[]) {
        super('VALIDATION_ERROR', Array.isArray(errors) ? errors.join('; ') : errors)
    }

    // shorthand
    static e (...errors: string[]): never {
        throw new ApiValidationError(errors)
    }
}

export class ObsoleteError extends ApiError {
    constructor (reason?: string) {
        super('Obsolete', reason)
    }
}

export type ExternalService =
    | 'mal'          // MyAnimeList.net
    | 'anidb'        // AniDB.net
    | 'worldart'     // World-Art.ru
    | 'kitsu'        // Kitsu.io
    | 'anilist'      // AniList.co
    | 'ann'          // AnimeNewsNetwork.com
    | 'allcinema'    // AllCinema.net
    | 'fansubs'      // FanSubs.ru
    | 'crunchyroll'  // CrunchyRoll.net
    | 'kp'           // KinoPoisk.ru
    | 'imdb'         // IMDb.com
    | 'mangaupdates' // MangaUpdates.com
    | 'thetvdb'      // TheTVDB.com
    | 'trakt'        // Trakt.TV
    | 'mydramalist'  // MyDramaList.com
    | 'anime365'     // anime365.ru

export enum MediaType {
    anime = 'anime',
    manga = 'manga',
    // ranobe = 'ranobe'
    // most services store ranobe as manga
}

export type ExternalServiceMappings = OptionalRecord<ExternalService, string>


export enum ConnectableService {
    Shikimori = 'S'
}

export class Paginated {
    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    limit?: Numeric

    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    offset?: Numeric
}

@EntityConstructor({})
export class PaginatedSorted extends Paginated {
    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    limit?: Numeric

    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    offset?: Numeric

    @Expose()
    @IsOptional()
    @IsString()
    sort?: string
}

export enum UserRateStatus {
    Planned = 'planned',
    InProgress = 'in_progress',
    Completed = 'completed',
    OnHold = 'on_hold',
    Dropped = 'dropped'
}

export class UserRate {
    @Expose()
    @IsNumber()
    id: number

    @Expose()
    user_id?: string | number

    @Expose()
    @IsNumber()
    target_id: number

    @Expose()
    @IsEnum(MediaType)
    target_type: MediaType

    @Expose()
    @IsNumber()
    score: number | null

    @Expose()
    @IsEnum(UserRateStatus)
    status: UserRateStatus

    @Expose()
    @IsNumber()
    parts: number

    @Expose()
    @IsNumber()
    partsVolumes?: number

    @Expose()
    @IsNumber()
    repeats: number

    created_at: string
    updated_at: string

    // a context item which server may (or may not) return
    // and which should be passed in update requests
    // (eg it may contain secret token of a user rate which is needed to edit it)
    // client is free to modify it, but really shouldnt
    @Expose()
    ctx?: any
}

export interface PaginatedResponse<T> {
    count: number
    items: T[]
}

declare module 'koa' {
    interface Context {
        session: ISession
        raw?: boolean
    }
}
