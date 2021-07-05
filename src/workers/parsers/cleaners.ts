import { Translation } from '@/models/Translation'
import { In } from 'typeorm'
import { uniqueBy } from '@/helpers/object-utils'
import { StatisticsDay } from '@/models/StatisticsDay'
import { TLoggerQueue } from '@/data/queues'
import { batchRunIterableParsers, getRunnableParsers } from './comon'

export async function runCleaners (only: string[]): Promise<void> {
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
