import { ExternalService, ExternalServiceMappings, MediaType } from '@/types'
import Mapping from '@/models/Mapping'
import { KeyValue } from '@/models/KeyValue'

export function strFill (char: string, size: number): string {
    const r: string[] = []
    for (let i = 0; i < size; i++) {
        r[i] = char
    }
    return r.join('')
}

export function padLeft (text: string, length: number, char = ' '): string {
    if (text.length >= length) return text
    const d = length - text.length
    return strFill(char, d) + text
}

export function renderProgress (current: number, total: number): void {
    const part = current / total
    const pbs = process.stdout.columns - total.toString(10).length * 2 - 6
    const w = Math.round(part * pbs)
    process.stdout.write(`[${strFill('#', w)}${strFill('-', pbs - w)}] ` +
        `${padLeft(current.toString(10), total.toString(10).length)}/${total}\r`)
}

export function clearProgress (): void {
    process.stdout.write(strFill(' ', process.stdout.columns) + '\r')
}

export const log = (...args): void => console.log('[i]', ...args)


type UrlTransformer = [RegExp, ExternalService, number] | [RegExp, ExternalService, number, boolean]

interface MappingMeta {
    name: ExternalService
    id: string
}

const urlTransformers: UrlTransformer[] = [
    [/^(?:https?:)?\/\/(?:www\.)?animenewsnetwork\.com\/encyclopedia\/anime\.php\?id=(\d+)/, 'ann', 1],
    [/^(?:https?:)?\/\/anidb\.net\/(?:perl-bin\/animedb\.pl\?show=anime&aid=|anime\/)(\d+)/, 'anidb', 1],
    [/^(?:https?:)?\/\/myanimelist\.net\/anime\/(\d+)/, 'mal', 1],
    [/^(?:https?:)?\/\/(?:www\.)?allcinema\.net\/cinema\/(\d+)/, 'allcinema', 1],
    [/^(?:https?:)?\/\/(?:www\.)?fansubs.ru\/base\.php\?id=(\d+)/, 'fansubs', 1],
    [/^(?:https?:)?\/\/(?:www\.)?kinopoisk\.ru\/film\/(\d+)/, 'kp', 1],
    [/^(?:https?:)?\/\/(?:www\.)?mangaupdates.com\/series\.html\?id=(\d+)/, 'mangaupdates', 1],
    [/^(?:https?:)?\/\/(?:www\.)?thetvdb\.com\/\?tab=series&id=(.+)/, 'thetvdb', 1]
]


export function urlToMeta (url: string): MappingMeta | null {
    for (const [regex, name, grp] of urlTransformers) {
        const match = regex.exec(url)
        if (match) {
            return {
                name,
                id: match[grp]
            }
        }
    }
    return null
}


export interface FetchOneResult {
    mappings: ExternalServiceMappings
    type: MediaType

    count?: number
    isLast?: boolean
    tag?: any
}

export interface IncrementalGrabOptions {
    alias: string
    kvKey: string
    fetcher: (id: number) => Promise<FetchOneResult | null>

    count?: number
}

export async function incrementalGrab (options: IncrementalGrabOptions): Promise<void> {
    const start = await KeyValue.get('import:' + options.kvKey, 0)
    let current = start + 1
    let count = options.count ?? 15000
    let failed = 0
    log(`Grabbing ${options.alias}, starting from ${current}`)

    while (true) {
        renderProgress(current, count)
        const data = await options.fetcher(current)
        if (data == null) {
            failed++
            current++
            if (failed >= 10) {
                break
            }
        } else {
            if (data.count) {
                count = data.count
            }
            await Mapping.extend(data.type, data.mappings)
            await KeyValue.set<number>('import:' + options.kvKey, current++)
        }
    }
    clearProgress()
    log('Finished, grabbed until ' + current + ' (exclusively), with a total of ' + (current - start - failed - 1))

}
