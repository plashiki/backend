import { FetchOneResult, incrementalGrab, urlToMeta } from './common'
import fetch from 'node-fetch'
import { decode } from 'iconv-lite'
import { load } from 'cheerio'
import { ExternalServiceMappings, MediaType } from '@/types'
import typeOrmLoader from '@/init/00_typeorm-loader'

async function fetchOne (id: number): Promise<FetchOneResult | null> {
    return fetch('http://www.fansubs.ru/base.php?id=' + id)
        .then(i => i.buffer())
        .then((buf) => {
            const text = decode(buf, 'windows-1251')

            if (text.match(/Нет данных на anime/)) {
                return null
            }

            const $ = load(text)
            const links = $('b:contains("Ссылки")')
                .next('blockquote')
                .find('a').toArray()
                .map(i => i.attribs.href)

            const map: ExternalServiceMappings = {
                fansubs: id + ''
            }

            links.forEach((url) => {
                const meta = urlToMeta(url)
                if (meta) {
                    map[meta.name] = meta.id
                }
            })


            return {
                mappings: map,
                type: MediaType.anime
            }
        })
}

typeOrmLoader().then(() => incrementalGrab({
    alias: 'fansubs',
    kvKey: 'fansubs',
    fetcher: fetchOne
})).catch(console.error)
