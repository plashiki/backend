import fetchRetry from '@/helpers/fetch-retry'
import { decode } from 'iconv-lite'
import { load } from 'cheerio'
import { parse } from 'querystring'
import { vkApi } from '@/external/vk'
import qs from 'querystring'

export interface PlayerMeta {
    title?: string
    description?: string
    uploader?: string
    url?: string
    // ---- //
    error?: string
}

interface MetaResolver {
    regex: RegExp
    resolve (...args: string[]): Promise<PlayerMeta | null>
}

let registered: MetaResolver[] = []

export async function resolveMeta (url: string): Promise<PlayerMeta | null> {
    for (let r of registered) {
        const match = url.match(r.regex)
        if (match) {
            match.shift()
            try {
                return await r.resolve(url, ...match)
            } catch (e) {
                return {
                    error: e
                }
            }
        }
    }

    return null
}

function reg (params: MetaResolver): void {
    registered.push(params)
}


reg({
    regex: /^https?:\/\/vk\.com\/video_ext\.php\?(.+)$/,
    resolve: async (url, p1) => {
        const p = parse(p1)
        if (!p.oid || !p.id) throw 'Video does not exist'
        const d = await vkApi('video.get', {
            count: 1,
            videos: `${p.oid}_${p.id}`
        })
        if (d.count !== 1) throw 'Video does not exist'
        const v = d.items[0]
        if (!v) throw 'Video does not exist'
        return {
            title: v.title,
            description: v.description,
            uploader: `https://vk.com/${v.owner_id < 0 ? `club${-v.owner_id}` : 'id' + v.owner_id}`,
            url: `https://vk.com/video${p.oid}_${p.id}`
        }
    }
})

reg({
    regex: /^https?:\/\/(?:smotret-?)?(?:anime|hentai)(?:-?365)?\.(?:ru|online)\/translations\/embed\/(\d+)/,
    resolve: async (url, trid) => {
        const d = await fetchRetry(`https://anime365.ru/api/translations/${trid}`).then(i => i.json())
        if (d.error) {
            throw 'Video does not exist'
        } else {
            return {
                title: d.data.title,
                uploader: d.data.authorsSummary,
                url: d.data.url
            }
        }
    }
})

reg({
    regex: /^https?:\/\/video\.sibnet\.ru\/shell.php\?videoid=(\d+)/,
    resolve: async (url, vid) => {
        const player = 'https://video.sibnet.ru/video' + vid
        const r = await fetchRetry(player).then(i => {
            if (i.status === 404) throw 'Video does not exist'

            return i.buffer()
        })

        const d = decode(r, 'win1251')
        const page = load(d)
        return {
            title: page('.video_name h1').text(),
            description: page('.video_text#video_text p:not(.summary)').text(),
            uploader: page('.video_name a.user_name').text(),
            url: player
        }
    }
})

reg({
    regex: /^https?:\/\/(?:www\.)?myvi\.(?:top|tv)\/embed\/[a-zA-Z0-9]+/,
    resolve: async (url) => {
        const page = await fetchRetry(url).then(i => i.text())
        const title = page.match(/<title>([^<]*)<\/title>/)
        if (!title) return null
        if (title[1] === 'Запрашиваемое видео не доступно') {
            throw 'Video does not exist'
        }
        const video = page.match(/<link rel="canonical" href="([^"]*)">/)
        return {
            title: title ? title[1] : undefined,
            url: video ? video[1] : undefined
        }
    }
})

reg({
    regex: /^https?:\/\/online\.animedia\.tv\/embed\/\d+\/\d+\/\d+/,
    resolve: async (url) => {
        const page = await fetchRetry(url).then(i => i.text())
        const title = page.match(/<title>([^<]*)<\/title>/)
        if (title) {
            return {
                title: title[1]
            }
        }
        return null
    }
})

reg({
    regex: /^https?:\/\/plashiki\.su\/player\/anilibria\?(.*)(?:$|#)/i,
    async resolve (_, query): Promise<PlayerMeta | null> {
        let params = qs.parse(query)
        let data = await fetchRetry('https://www.anilibria.tv/public/api/index.php', {
            method: 'POST',
            body: qs.stringify({
                query: 'release',
                id: params.rid,
                filter: 'code,names,voices'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(i => i.json())
        if (!data.status) {
            return {
                error: data.error.message
            }
        }
        return {
            title: `${data.data.names.join(' / ')} (эпизод ${params.eid})`,
            description: 'Озвучено: ' + data.data.voices.join(', '),
            url: `https://www.anilibria.tv/release/${data.data.code}.html`
        }
    }
})
