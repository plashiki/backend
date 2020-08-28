import { PathFunction } from 'path-to-regexp'
import { AnyKV } from '@/types/utils'
import { UserRateStatus } from '@/types/media'

export interface OAuthResponse {
    access_token: string
    token_type: string
    expires_in: number
    created_at: number
    refresh_token?: string
    scope?: string
}

export interface ShikimoriApiCallParams {
    endpoint: string | PathFunction
    httpMethod?: string
    params?: AnyKV
    query?: AnyKV
    body?: AnyKV | string
    api?: false

    asUser?: number
    token?: string
}

export type ShikimoriImageResolution = 'x16' | 'x32' | 'x48' | 'x64' | 'x80' | 'x148' | 'x160'

export type ShikimoriImage = Record<ShikimoriImageResolution, string>

export interface ShikimoriBriefUser {
    id: number
    nickname: string
    avatar: string
    image: ShikimoriImage
    last_online_at: string
    name: string | null
    sex: 'male' | 'female'
    website: string | null
    birth_on: string | null
    locale: string | null
}

export interface ShikimoriUser extends ShikimoriBriefUser {
    /* great api thx morr */
    birth_on: null
    locale: null
    full_years: number

    location: string | null
    banned: boolean
    about: string
    about_html: string
    common_info: string[]
    show_comments: boolean
    /* stats: ... idk tbh */
    style_id: number
}

export enum ShikimoriUserRateStatus {
    Planned = 'planned',
    Watching = 'watching',
    Rewatching = 'rewatching',
    Completed = 'completed',
    OnHold = 'on_hold',
    Dropped = 'dropped'
}

export const ShikimoriToUserRateStatusAdapter: Record<ShikimoriUserRateStatus, UserRateStatus> = {
    [ShikimoriUserRateStatus.Planned]: UserRateStatus.Planned,
    [ShikimoriUserRateStatus.Completed]: UserRateStatus.Completed,
    [ShikimoriUserRateStatus.OnHold]: UserRateStatus.OnHold,
    [ShikimoriUserRateStatus.Rewatching]: UserRateStatus.InProgress,
    [ShikimoriUserRateStatus.Watching]: UserRateStatus.InProgress,
    [ShikimoriUserRateStatus.Dropped]: UserRateStatus.Dropped
}
export const UserRateToShikimoriStatusAdapter: Record<UserRateStatus, ShikimoriUserRateStatus> = {
    [UserRateStatus.Planned]: ShikimoriUserRateStatus.Planned,
    [UserRateStatus.Completed]: ShikimoriUserRateStatus.Completed,
    [UserRateStatus.OnHold]: ShikimoriUserRateStatus.OnHold,
    [UserRateStatus.InProgress]: ShikimoriUserRateStatus.Watching,
    [UserRateStatus.Dropped]: ShikimoriUserRateStatus.Dropped
}

export interface ShikimoriUserRate {
    id: number
    user_id: number
    target_id: number
    target_type: 'Anime' | 'Manga'
    score: number
    status: ShikimoriUserRateStatus
    rewatches: number
    episodes: number
    volumes: number
    chapters: number
    text: string
    text_html: string
    created_at: string
    updated_at: string
}

export interface ShikimoriBriefMedia {
    id: number
    name: string
    russian: string
    image: ShikimoriImage
    url: string
    kind: string
    score: string
    status: string
    aired_on: string | null
    released_on: string | null
}
