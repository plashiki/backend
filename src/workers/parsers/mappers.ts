import { MapperResult } from '@/services/ParsersService'
import Mapping from '@/models/Mapping'
import { LOG } from '@/helpers/logging'
import { Translation, TranslationStatus } from '@/models/Translation'
import { MoreThanOrEqual } from 'typeorm'
import { TLoggerQueue } from '@/data/queues'
import { batchRunIterableParsers, getRunnableParsers } from '@/workers/parsers/comon'

export async function runMappers (only: string[]): Promise<void> {
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
    let translations = await Translation.createQueryBuilder('t').where({
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
