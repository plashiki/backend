import { asyncPool } from '@/helpers/async-pool'
import { LOG } from '@/helpers/logging'
import { ExternalService } from '@/types/media'
import { Parser } from '@/models/Parser'
import { Like } from 'typeorm'
import { ParsersService } from '@/services/ParsersService'
import { ParsersState, parsersState } from '@/workers/parsers/state'


export interface ExternalId {
    service: ExternalService
    id: string | number
}

export async function getRunnableParsers (kind: string, only: string[]): Promise<string[]> {
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

    await ParsersService.instance.loadParsers(uids)

    return uids
}

export function isValidUrl (url: string): boolean {
    try {
        let a = new URL(url)
        return !!a.protocol.match(/(ehttps?|https):/i)
    } catch (e) {
        return false
    }
}

export async function batchRunIterableParsers<T> (
    type: keyof ParsersState,
    uids: string[],
    callback: (ctx: any, uid: string, item: T) => Promise<void>,
    params: any = undefined,
    atOnce = 5
): Promise<Record<string, number>> {
    if (!uids.length) return {}
    parsersState[type].states = {}

    uids.forEach((uid) => {
        parsersState[type].states[uid] = 'waiting'
    })

    const stats = {}
    const ctxes: Record<string, any> = {}

    const runSingleParser = async (idx: number, uid: string): Promise<void> => {
        parsersState[type].states[uid] = 'preparing'
        const parser = await ParsersService.instance.getParserAndLoadDependencies(uid)
        if (!parser) throw new Error('Parser not found')

        const ctx = ParsersService.instance.getContextFor(parser, params)
        ctxes[uid] = ctx
        const iter = await ParsersService.instance.executeParser(parser, undefined, ctx)

        let count = 0
        parsersState[type].states[uid] = `running|${count}`
        for await (let it of iter) {
            parsersState[type].states[uid] = `running|${count++}`
            await callback(ctx, uid, it)
        }
        parsersState[type].states[uid] = `finished|${count}`
    }

    for await (let { item, error } of asyncPool(runSingleParser, uids, atOnce)) {
        if (error) {
            parsersState[type].states[item] = `error\n${error.stack}`
            LOG.parsers.error('Error while running %s: %s', item, error)
        }
    }

    uids.forEach((uid) => {
        if (ctxes[uid]) {
            stats[uid] = ctxes[uid].__stat ?? 0
        }
    })

    return stats
}
