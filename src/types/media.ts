import { Expose } from 'class-transformer'
import { IsEnum, IsNumber } from 'class-validator'
import { OptionalRecord } from '@/types/utils'

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