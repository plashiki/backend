// Purpose: incrementally import World-Art entries to create/extend mappings

import fetch from 'node-fetch'
import { decode } from 'iconv-lite'
import { load } from 'cheerio'
import { ExternalServiceMappings, MediaType } from '@/types'
import { FetchOneResult, incrementalGrab, urlToMeta } from './common'
import typeOrmLoader from '@/init/00_typeorm-loader'

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36'
}


const fetchAnime = (id: number, retryN = 0): Promise<FetchOneResult | null> => {
    const url = 'http://www.world-art.ru/animation/animation.php?id=' + id
    return fetch(url, { headers })
        .then(i => i.buffer())
        .then((buf) => {
            const text = decode(buf, 'windows-1251')
            const $ = load(text)

            // worldart is weird
            if ($('meta[http-equiv=Refresh]').length) {
                // invalid id or flood wait, retry a few times
                if (retryN === 3) return null
                return fetchAnime(id, retryN + 1)
            }
            const canonical = $('link[rel=canonical]').attr('href')
            if (canonical === 'http://www.world-art.ru/animation/animation.php?id=1' && id !== 1) {
                return null // non-existent id
            }

            // holy fuck
            const urls = $('td.bg2:contains("Сайты")')
                .closest('table')
                .next()
                .nextAll('noindex')
                .find('a').toArray()
                .map(i => i.attribs.href)

            const mappings: ExternalServiceMappings = {}
            urls.forEach((href) => {
                const meta = urlToMeta(href)
                if (meta) {
                    mappings[meta.name] = meta.id
                }
            })

            mappings.worldart = id + ''

            return {
                mappings,
                type: MediaType.anime
            }
        })
}

const fetchManga = (id: number, retryN = 0): Promise<FetchOneResult | null> => {
    const url = 'http://www.world-art.ru/animation/manga.php?id=' + id
    return fetch(url, { headers })
        .then(i => i.buffer())
        .then((buf) => {
            const text = decode(buf, 'windows-1251')
            const $ = load(text)
            if ($('meta[http-equiv=Refresh]').length) {
                // invalid/non-existent id or flood wait, retry a few times
                if (retryN === 3) return null
                return fetchManga(id, retryN + 1)
            }

            const urls = $('b:contains("Сайты")')
                .closest('tr')
                .find('td.review > a.review').toArray()
                .map(i => i.attribs.href)

            const mappings: ExternalServiceMappings = {}
            urls.forEach((href) => {
                const meta = urlToMeta(href)
                if (meta) {
                    mappings[meta.name] = meta.id
                }
            })

            const match = $('font[size=5]').text().match(/\((манга|раноб[еэ])\)/)

            if (!match) {
                return null
            }

            mappings.worldart = id + ''

            return {
                mappings,
                type: /* match[1] === 'манга' ? */ MediaType.manga //  : MediaType.ranobe
            }
        })
}

async function main (): Promise<void> {
    await typeOrmLoader()

    await incrementalGrab({
        alias: 'world-art animes',
        kvKey: 'wa-last',
        fetcher: fetchAnime
    })
    await incrementalGrab({
        alias: 'world-art animes',
        kvKey: 'wa-last-manga',
        fetcher: fetchManga
    })
}

main().catch(console.error)
