// Purpose: incrementally imports anilist id <-> mal id mappings
// First run should be done in one go

import fetch from 'node-fetch'
import { clearProgress, FetchOneResult, log, renderProgress } from './common'
import typeOrmLoader from '@/init/00_typeorm-loader'
import { enumerate } from '@/helpers/object-utils'
import { AnyKV, MediaType } from '@/types'
import { isProduction } from '@/config'
import Mapping from '../../models/Mapping'
import { KeyValue } from '@/models/KeyValue'

async function * fetchPage (page: number, untilUpdatedAt: number): AsyncGenerator<FetchOneResult> {
    const json = await fetch('https://graphql.anilist.co/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: `{"query":"{Page(page:${page},perPage:50)` +
            '{pageInfo{hasNextPage,total}media(sort:UPDATED_AT_DESC,idMal_not:null){' +
            'id idMal type updatedAt}}}","variables":null,"operationName":null}'
    }).then(i => i.json())
    const data = json.data
    if (!data.Page?.media) return

    const lastI = data.Page.media.length - 1

    for (let [i, it] of enumerate<AnyKV>(data.Page.media)) {
        yield {
            mappings: {
                anilist: it.id + '',
                mal: it.idMal + ''
            },
            type: it.type === 'ANIME' ? MediaType.anime : MediaType.manga,
            isLast: !data.Page.pageInfo.hasNextPage && i === lastI || it.updatedAt <= untilUpdatedAt,

            tag: it.updatedAt,
            count: data.Page.pageInfo.total
        }
    }
}

async function main (): Promise<void> {
    await typeOrmLoader()

    let page = 1
    let i = 0
    let until = await KeyValue.get('import:anilist-last', 0)
    log('Grabbing from anilist, last is ' + until)
    let first = true

    mainLoop:
        while (true) {
            for await (let it of fetchPage(page++, until)) {

                renderProgress(i++, it.count!)

                if (first && isProduction) {
                    await KeyValue.set('import:anilist-last', it.tag)
                    first = false
                }
                await Mapping.extend(it.type, it.mappings)

                if (it.isLast) {
                    break mainLoop
                }
                renderProgress(i, it.count!)
            }
        }

    clearProgress()
    log('Finished!')
}

main().catch(console.error)
