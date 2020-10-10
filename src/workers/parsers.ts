import { LOG } from '@/helpers/logging'
import { Parser } from '@/models/Parser'
import { In, Like, MoreThanOrEqual } from 'typeorm'
import { MapperResult, ParsersService } from '@/services/ParsersService'
import { chunks, uniqueBy } from '@/helpers/object-utils'
import { Translation, TranslationStatus } from '@/models/Translation'
import { TranslationService } from '@/services/TranslationService'
import { StatisticsDay } from '@/models/StatisticsDay'
import { TLoggerQueue } from '@/data/queues'
import typeOrmLoader from '@/init/00_typeorm-loader'
import Mapping from '@/models/Mapping'
import { RelationsParser } from '@/helpers/relations'
import qs from 'qs'
import { asyncPool } from '@/helpers/async-pool'
import { ExternalService } from '@/types/media'

interface ExternalId {
    service: ExternalService
    id: string | number
}

const service = ParsersService.instance
const translationService = new TranslationService()

let typeorm: boolean | Promise<void> = false

const state = {
    importers: {
        running: false,
        states: {}
    },
    mappers: {
        running: false,
        states: {}
    },
    cleaners: {
        running: false,
        states: {}
    }
}
export type ParsersState = typeof state

async function batchRunIterableParsers<T> (
    type: keyof ParsersState,
    uids: string[],
    callback: (ctx: any, uid: string, item: T) => Promise<void>,
    params: any = undefined,
    atOnce = 5
): Promise<Record<string, number>> {
    if (!uids.length) return {}
    state[type].states = {}

    uids.forEach((uid) => {
        state[type].states[uid] = 'waiting'
    })

    const stats = {}
    const ctxes: Record<string, any> = {}

    const runSingleParser = async (idx: number, uid: string): Promise<void> => {
        state[type].states[uid] = 'preparing'
        const parser = await service.getParserAndLoadDependencies(uid)
        if (!parser) throw new Error('Parser not found')

        const ctx = service.getContextFor(parser, params)
        ctxes[uid] = ctx
        const iter = await service.executeParser(parser, undefined, ctx)

        let count = 0
        state[type].states[uid] = `running|${count}`
        for await (let it of iter) {
            state[type].states[uid] = `running|${count++}`
            await callback(ctx, uid, it)
        }
        state[type].states[uid] = `finished|${count}`
    }

    for await (let { item, error } of asyncPool(runSingleParser, uids, atOnce)) {
        if (error) {
            state[type].states[item] = `error\n${error.stack}`
            LOG.parsers.error('Error while running %s: %s', item, error)
        }
    }

    // for (let chunk of chunks(uids, atOnce)) {
    //     await Promise.all(chunk.map(async (uid) => {
    //         try {
    //             const parser = await service.getParserAndLoadDependencies(uid)
    //             if (!parser) return
    //
    //             const ctx = service.getContextFor(parser, params)
    //             ctxes[uid] = ctx
    //             const iter = await service.executeParser(parser, undefined, ctx)
    //
    //
    //         } catch (e) {
    //             LOG.parsers.error('Error while running %s: %s', uid, e)
    //         }
    //     }))
    // }

    uids.forEach((uid) => {
        if (ctxes[uid]) {
            stats[uid] = ctxes[uid].__stat ?? 0
        }
    })

    return stats
}

async function getRunnableParsers (kind: string, only: string[]): Promise<string[]> {
    const onlyUids = await Parser.find({
        where: {
            uid: Like(kind + '/%'),
            disabled: false,
            cri: false
        },
        select: ['uid']
    })

    let uids = onlyUids.map(i => i.uid)

    if (only.length) {
        uids = uids.filter(i => only.indexOf(i) !== -1)
    }

    await service.loadParsers(uids)

    return uids
}

function isValidUrl (url: string): boolean {
    try {
        let a = new URL(url)
        return !!a.protocol.match(/(ehttps?|https):/i)
    } catch (e) {
        return false
    }
}

async function runImporters (only: string[]): Promise<void> {
    const parsers = await getRunnableParsers('importers', only)
    let items: Partial<Translation>[] = []
    let total = 0
    let perParserTotal = {}

    let perParserItems = await batchRunIterableParsers<Partial<Translation>>(
        'importers', parsers,
        async (ctx, uid, item) => {
            // normalize fields
            if (!('author' in item)) item.author = ''
            if (!('status' in item)) item.status = TranslationStatus.Added
            if (!('groups' in item)) item.groups = []
            if (
                !item.target_id
                || !item.target_type
                || !item.part
                || !item.url
                || !isValidUrl(item.url)
                || !item.kind
                || !item.lang
            ) {
                LOG.parsers.warn('Incomplete translation encountered at %s: %o', uid, item)
                return
            }

            if (typeof item.target_id === 'object') {
                let target = item.target_id as ExternalId

                if (target.service === 'mal') {
                    item.target_id = parseInt(target.id as string)
                } else {
                    let mapping = await Mapping.findFull(item.target_type, {
                        [target.service]: target.id
                    })

                    if (mapping && mapping.external.mal) {
                        item.target_id = parseInt(mapping.external.mal)
                    } else {
                        item.url = 'map:?' + qs.stringify({
                            st: item.status,
                            u: item.url,
                            se: target.service,
                            id: target.id
                        })
                        item.groups!.push('mapping')
                        item.status = TranslationStatus.Mapping
                        item.target_id = -1
                    }
                }
            } else {
                let redirection = RelationsParser.instance.findRelation(item.target_id, 'mal', item.part)
                if (redirection && redirection.id.mal) {
                    item.target_id = parseInt(redirection.id.mal)
                    item.part = redirection.n
                }
            }

            item.groups!.push(`from-parser:${uid}`)
            items.push(item)

            if (!perParserTotal[uid]) {
                perParserTotal[uid] = 0
            }
            perParserTotal[uid]++

            if (items.length >= 250) {
                total += await translationService.addTranslations(items)
                items = []
            }
        }
    )

    total += await translationService.addTranslations(items)

    // update stats
    let perParserEfficiency = {}
    const today = await StatisticsDay.today()
    Object.keys(perParserItems).forEach((uid) => {
        if (perParserTotal[uid] !== 0 && perParserItems[uid] !== 0) {
            let efficiency = perParserTotal[uid] / perParserItems[uid]

            perParserEfficiency[uid] = efficiency
            let key = 'efficiency:' + uid
            if (!today.data[key]) {
                today.data[key] = efficiency
            } else {
                today.data[key] *= efficiency
            }
        }

        let key = 'tr-added:' + uid
        if (!today.data[key]) {
            today.data[key] = perParserItems[uid]
        } else {
            today.data[key] += perParserItems[uid]
        }
    })

    await today.save()

    TLoggerQueue.add('importers-run', {
        perParserEfficiency,
        perParserItems,
        perParserTotal,
        total
    })
}

async function runMappers (only: string[]): Promise<void> {
    const parsers = await getRunnableParsers('mappers', only)
    let total = 0

    await batchRunIterableParsers<MapperResult>(
        'mappers', parsers,
        async (ctx, uid, { type, mappings: item }) => {
            if (!Object.keys(item)) return

            try {
                await Mapping.extend(type, item)
                total += 1
            } catch (e) {
                LOG.parsers.warn('Conflicting mappings: %s %o', type, item)
            }
        }
    )

    // try to update translations in `mapping` state
    let updatedCount = 0
    let staleIndex: Record<string, number> = {}
    let staleCount = 0

    let monthAgo = Date.now() - 2592000000
    let almostMonthAgo = monthAgo + 604800000
    let translations = await Translation.createQueryBuilder().where({
        status: TranslationStatus.Mapping,
        updated_at: MoreThanOrEqual(new Date(monthAgo))
    }).addSelectHidden().getMany()
    for (let tr of translations) {
        let url = new URL(tr.url)
        if (url.protocol !== 'map:') continue

        let mapping = await Mapping.findFull(tr.target_type, {
            [url.searchParams.get('se') as any]: url.searchParams.get('id')
        })
        if (mapping && mapping.external.mal) {
            tr.url = url.searchParams.get('u')!
            tr.status = url.searchParams.get('st') as any
            tr.target_id = parseInt(mapping.external.mal)
            tr.groups = tr.groups.filter(i => i !== 'mapping')

            await tr.save()
            updatedCount += 1
        } else if (tr.updated_at.getTime() <= almostMonthAgo) {
            staleCount += 1

            let service = url.searchParams.get('se')!
            if (!(service in staleIndex)) {
                staleIndex[service] = 0
            }
            staleIndex[service] += 1
        }
    }

    TLoggerQueue.add('mappers-run', {
        total,
        updatedCount,
        leftCount: translations.length - updatedCount,
        staleCount,
        topServices: Object.keys(staleIndex)
            .sort((a, b) => staleIndex[b] - staleIndex[a])
            .map(k => `${k} (${staleIndex})`)
            .join(', ')
    })
}

async function runCleaners (only: string[]): Promise<void> {
    const parsers = await getRunnableParsers('cleaners', only)
    let total = 0
    let buffer: number[] = []
    let perCleanerTotal = {}

    await batchRunIterableParsers<number>(
        'cleaners', parsers,
        async (ctx, uid, id) => {
            if (typeof id as any !== 'number') return
            if (!perCleanerTotal[uid]) {
                perCleanerTotal[uid] = 0
            }
            perCleanerTotal[uid] += 1

            buffer.push(id)
            if (buffer.length >= 50) {
                const result = await Translation.delete({
                    id: In(uniqueBy(buffer))
                })
                total += result.affected as number
                buffer = []
            }
        },
        { Translation }
    )

    if (buffer.length) {
        const result = await Translation.delete({
            id: In(uniqueBy(buffer))
        })
        total += result.affected as number
    }

    const today = await StatisticsDay.today()
    Object.keys(perCleanerTotal).forEach((uid) => {
        let key = 'tr-rem:' + uid
        if (!today.data[key]) {
            today.data[key] = perCleanerTotal[uid]
        } else {
            today.data[key] += perCleanerTotal[uid]
        }
    })
    await today.save()

    TLoggerQueue.add('cleaners-run', {
        total
    })
}

process.on('message', function onMessage (e) {
    // ensure typeorm is loaded
    if (typeorm === false) {
        typeorm = typeOrmLoader().then(() => {
            typeorm = true
            onMessage(e)
        })
        return
    }
    if (typeorm !== true) {
        typeorm.then(() => onMessage(e))
        return
    }

    if (!e || !e.act) return

    if (e.act === 'run-importers' && !state.importers.running) {
        state.importers.running = true
        runImporters(e.only).catch(LOG.parsers.error).then(() => {
            state.importers.running = false
        })
    }

    if (e.act === 'run-mappers' && !state.mappers.running) {
        state.mappers.running = true
        runMappers(e.only).catch(LOG.parsers.error).then(() => {
            state.mappers.running = false
        })
    }

    if (e.act === 'run-cleaners' && !state.cleaners.running) {
        state.cleaners.running = true
        runCleaners(e.only).catch(LOG.parsers.error).then(() => {
            state.cleaners.running = false
        })
    }

    if (e.act === 'state') {
        process.send!({ state, rid: e.rid })
    }
})
