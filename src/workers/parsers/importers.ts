import { Translation, TranslationStatus } from '@/models/Translation'
import { LOG } from '@/helpers/logging'
import Mapping from '@/models/Mapping'
import qs from 'qs'
import { RelationsParser } from '@/helpers/relations'
import { StatisticsDay } from '@/models/StatisticsDay'
import { TLoggerQueue } from '@/data/queues'
import { batchRunIterableParsers, ExternalId, getRunnableParsers, isValidUrl } from '@/workers/parsers/comon'
import { TranslationService } from '@/services/TranslationService'

export async function runImporters (service: TranslationService, only: string[]): Promise<void> {
    const parsers = await getRunnableParsers('importers', only)
    let items: Partial<Translation>[] = []
    let total = 0
    let perParserTotal = {}

    let perParserItems = await batchRunIterableParsers<Partial<Translation>>(
        'importers', parsers,
        async (ctx, uid, item) => {
            // normalize fields
            if (!('author' in item)) item.author = {}
            if (item.author?.people && !item.author.people.length) delete item.author.people
            if (item.author?.group && !item.author.group.length) delete item.author.group
            if (item.author?.ripper && !item.author.ripper.length) delete item.author.ripper
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
                total += await service.addTranslations(items)
                items = []
            }
        }
    )

    total += await service.addTranslations(items)

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
