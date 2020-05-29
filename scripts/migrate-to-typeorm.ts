// Created for migration from old database to fresh new TypeORM
import { Pool } from 'pg'
import typeOrmLoader from '@/init/00_typeorm-loader'
import { User } from '@/models/User'
import { Translation, TranslationKind, TranslationLanguage, TranslationStatus } from '@/models/Translation'
import { StatisticsDay } from '@/models/StatisticsDay'
import { clearProgress, log, renderProgress } from '@/workers/mapping-importers/common'
import { MediaType } from '@/types'
import { createIndex } from '@/helpers/object-utils'
import { normalizeUrl } from '@/helpers/utils'

const UNSHORTEN_MAP = {
    '&': 'https://video.sibnet.ru/shell.php?videoid=',
    $: 'https://vk.com/video_ext.php?oid=',
    '*': 'https://videoapi.my.mail.ru/videos/embed/',
    '(': 'https://ok.ru/videoembed/',
    '%': 'https://youtube.com/embed/',
    '|': 'https://smotret-anime.online/translations/embed/',
    '^': 'https://www.myvi.top/embed/',
    ')': 'https://sovetromantica.com/embed/episode_'
}
const unshorten = (url: string): string => (
    UNSHORTEN_MAP[url[0]] ? UNSHORTEN_MAP[url[0]] + url.substr(1) : url
)


async function main (): Promise<void> {
    const from = process.env.MIGRATE_SOURCE
    const pool = new Pool({
        connectionString: from
    })

    await typeOrmLoader({
        logging: ['schema', 'error', 'warn', 'info', 'log', 'migration']
    }, true)

    log('Getting users')
    const users = await pool.query('select * from users where shiki_id is not null order by id asc')
    log('Inserting users')
    let used_nicknames = new Set()
    let cacheT = Math.round(Date.now())
    const insertedUsers = await User.createQueryBuilder().insert().values(users.rows.map((i) => {
        delete i.id


        let nickname_ind = 0
        while (used_nicknames.has(i.nickname + (nickname_ind || ''))) {
            nickname_ind++
        }
        i.nickname += nickname_ind || ''
        used_nicknames.add(i.nickname)

        i.external_ids = { S: i.shiki_id }
        i.first_login_at = new Date(parseInt(i.first_login_at))
        i.avatar = 'https://shikimori.one/system/users/x160/' + i.shiki_id + '.png?' + cacheT
        i.service = 'S'
        delete i.shiki_id
        return i
    })).returning('id, nickname').execute()

    const usersById = createIndex(users.rows, 'id')
    const insertedUsersByNickname = createIndex(insertedUsers.generatedMaps, 'nickname')

    log('Getting translations')
    const translations = await pool.query('select *, 1 state from videos where anime_id is not null')
    log('Getting moderation entries')
    // state = 1 entries are in `translations` already.
    const moderation = await pool.query('select * from moderation where anime_id is not null and state <> 1')

    log('Merging translations and moderation')
    const merged = [...translations.rows, ...moderation.rows]
    log('Inserting...')
    const existent = new Set()

    let count = 0
    const total = merged.length
    const chunkSize = 5000
    const tormItems: Partial<Translation>[] = []

    for (const tr of merged) {
        tr.url = normalizeUrl(unshorten(tr.url))

        if (existent.has(tr.url)) {
            continue
        }
        existent.add(tr.url)

        const obj: Partial<Translation> = {
            target_id: tr.anime_id,
            target_type: MediaType.anime,
            part: tr.episode,
            kind: [
                TranslationKind.Original,
                TranslationKind.Subtitles,
                TranslationKind.Dubbed
            ][tr.kind],
            lang: [
                TranslationLanguage.Russian,
                TranslationLanguage.English,
                TranslationLanguage.Japanese,
                TranslationLanguage.Other
            ][tr.lang],
            hq: tr.kind === 1,
            author: tr.author,
            url: tr.url,
            status: [
                TranslationStatus.Pending,
                TranslationStatus.Added,
                TranslationStatus.Declined
            ][tr.state]
        }

        if (!obj.target_id || !obj.part || !obj.kind || !obj.lang || !obj.status) continue

        if (tr.uploader) {
            if (typeof tr.uploader === 'number') {
                tr.uploader = usersById[tr.uploader]
                if (tr.uploader) {
                    tr.uploader = tr.uploader.nickname
                }
            }

            let user: number | undefined = undefined
            if (tr.uploader) {
                if (tr.uploader in insertedUsersByNickname) {
                    user = insertedUsersByNickname[tr.uploader].id
                }
                obj.uploader_id = user
            }
        }

        tormItems.push(obj)

        if (tormItems.length >= chunkSize) {
            await Translation.createQueryBuilder()
                .insert()
                .values(tormItems)
                .onConflict('(url) do nothing')
                .execute()

            count += tormItems.length
            tormItems.length = 0

            renderProgress(count, total)
        }
    }

    if (tormItems.length >= 0) {
        await Translation.createQueryBuilder()
            .insert()
            .values(tormItems)
            .onConflict('(url) do nothing')
            .execute()
        tormItems.length = 0
    }

    count += chunkSize
    renderProgress(count, total)
    clearProgress()
    log('Getting stats')
    const stats = await pool.query('select * from stats')

    log('Inserting stats')
    await StatisticsDay.createQueryBuilder().insert().values(stats.rows.map((i) => {
        const ts = i.ts
        delete i.ts
        return {
            day: ts,
            data: i
        }
    }))
    await pool.end()
    log('Done! If script hangs press Crtl-C') // idk im lazy to debug.
}

main().catch(console.exception).then(() => console.log('OK!'))
