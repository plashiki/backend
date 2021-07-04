import { Translation } from '@/types/translation'
import { makeApiRequest } from './internal/request'
import { MediaType } from '@/types/media'

export function getSingleTranslation (id: number): Promise<Translation> {
    return makeApiRequest({
        path: '/v2/translations/' + id
    })
}

export function getTranslations (ids: number[]): Promise<Translation[]> {
    return makeApiRequest({
        path: '/v2/translations',
        query: {
            ids: ids.join(','),
            fullAuthor: '',
        }
    })
}

export function getAvailableParts (mediaId: number, mediaType: MediaType, include365: boolean): Promise<number[]> {
    return makeApiRequest({
        path: `/v2/translations/${mediaType}/${mediaId}/parts`,
        query: {
            include365: include365 ? '' : undefined
        }
    })
}
export function getTranslationsFor (mediaId: number, mediaType: MediaType, part?: number, fullAuthor = true): Promise<Translation[]> {
    return makeApiRequest({
        path: `/v2/translations/${mediaType}/${mediaId}` + (part ? '/parts/' + part : ''),
        query: {
            raw: '',
            fullAuthor: fullAuthor ? '' : undefined,
            external: 'proto'
        }
    })
}
