// Purpose: incrementally import kitsu mappings and use them to create/extend mappings
// First run should be done in one go.

import fetch from 'node-fetch'
import typeOrmLoader from '../../init/00_typeorm-loader'
import { clearProgress, log, renderProgress } from './common'
import { ExternalService, ExternalServiceMappings } from '@/types'
import { isProduction } from '@/config'
import Mapping from '../../models/Mapping'
import { KeyValue } from '@/models/KeyValue'

// noinspection SpellCheckingInspection
const aliases: Record<string, ExternalService> = {
    mangaupdates: 'mangaupdates',
    anidb: 'anidb',
    'myanimelist/anime': 'mal',
    'myanimelist/manga': 'mal',
    anilist: 'anilist',
    animenewsnetwork: 'ann',
    thetvdb: 'thetvdb',
    trakt: 'trakt',
    mydramalist: 'mydramalist'
}

async function main (): Promise<void> {
    await typeOrmLoader()

    let last = isProduction && await KeyValue.get('import:kitsu-last', '') || '1970-01-01T00:00:00.000Z'
    log('Starting importing kitsu data')
    log(`Last imported: ${last}`)

    let offset = 0
    let first = -1

    mainLoop:
        while (true) {
            const page = await fetch('https://kitsu.io/api/edge/mappings?page[limit]=20&' +
                'sort=-updatedAt&include=item&fields[item]=id&page[offset]=' + offset).then(i => i.json())
            if (page.errors) {
                throw page.errors
            }

            offset += 20

            for (let mapping of page.data) {
                if (first === -1) {
                    await KeyValue.set<string>('import:kitsu-last', mapping.attributes.updatedAt)
                    first = mapping.id
                }

                renderProgress(first - mapping.id, first)

                if (mapping.attributes.updatedAt <= last) {
                    break mainLoop
                }

                if (!mapping.relationships?.item?.data) continue


                const type = mapping.relationships.item.data.type
                if (type !== 'anime' && type !== 'manga') {
                    if (type !== 'people') { // kto (who?)
                        log(`Unknown type: ${type}`)
                    }
                    continue
                }

                let map: ExternalServiceMappings = {
                    kitsu: mapping.relationships.item.data.id
                }

                const site = mapping.attributes.externalSite

                if (site === 'hulu' || site === 'aozora') {
                    // useless info, ignore
                    continue
                }

                let sid = mapping.attributes.externalId as string

                const alias = aliases[site]
                if (alias === 'anilist') {
                    sid = sid.split('/').pop()! // weird flex
                }

                if (!alias) {
                    log(`Unknown external service: ${site}`)
                    continue
                }
                map[alias] = sid

                await Mapping.extend(type, map)
            }

            if (page.data.length < 20) {
                break
            }
        }

    clearProgress()
    log('Finished.')
}

main().catch(console.error)
