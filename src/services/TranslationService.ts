import { Translation, TranslationStatus } from '@/models/Translation'
import { URL } from 'url'
import SortedArray from '@/helpers/sorted-array'
import {
    GetTranslationParameters,
    GetTranslationsParameters,
    TranslationQueryAuthor,
    TranslationQueryExternalType,
    TranslationQueryResult,
    TranslationQueryResultCompat
} from './TranslationService.types'
import { In } from 'typeorm'
import { chunks, dropUndefined, strip, uniqueBy } from '@/helpers/object-utils'
import { TranslationNotifierQueue } from '@/data/queues'
import { rowsToColumns } from '@/helpers/utils'
import { externalRedirectPage } from '@/config'
import { AnyKV, AtLeast, numericToNumber } from '@/types/utils'
import { PaginatedResponse, PaginatedSorted } from '@/types/api'
import { MediaType } from '@/types/media'
import { ApiError } from '@/types/errors'

export class TranslationService {
    async getTranslations<T extends GetTranslationsParameters> (params: GetTranslationsParameters):
        Promise<T extends { raw: any } ? Translation[] : TranslationQueryResult> {
        params = dropUndefined(params)

        if (Array.isArray(params.target_id)) {
            params.target_id = In(params.target_id)
        }

        let opts = {
            status: 'added',
            ...strip({ ...params }, ['raw', 'external', 'needUploader', 'renameAsAnime'], true)
        } as any


        const builder = Translation
            .createQueryBuilder('translation')
            .where(opts)

        // building query from params
        if ('needUploader' in params) {
            builder.leftJoin('translation.uploader', 'user')
                .addSelect(['user.id', 'user.nickname', 'user.avatar'])
        }

        if ('needState' in params) {
            builder.addSelect('translation.state')
        }

        if ('limit' in params) {
            builder.limit(numericToNumber(params.limit))
        }

        if ('offset' in params) {
            builder.offset(numericToNumber(params.offset))
        }

        let items = await builder.getMany()
        if ('raw' in params) {
            if (params.renameAsAnime) {
                // compat with anime api v1/v2
                items = items.map((i: AnyKV) => {
                    i.anime_id = i.target_id
                    i.target_id = undefined
                    i.target_type = undefined

                    i.episode = i.part
                    i.part = undefined
                    i.quality = i.hq ? 'bd' : 'tv'

                    return i
                }) as any
            }

            if (params.external !== TranslationQueryExternalType.Protocol) {
                items = items.map((i) => this.normalizeTranslationUrl(i))
            }

            return items as any
        } else {
            if (params.renameAsAnime) {
                // compat with anime api v1/v2
                items = items.map((i: AnyKV) => {
                    i.quality = i.hq ? 'bd' : 'tv'

                    return i
                }) as any
            }

            return this.processTranslations(items, params.external) as any
        }
    }

    async getAvailableParts (targetId: number, targetType: MediaType): Promise<number[]> {
        const builder = Translation.createQueryBuilder()
            .distinctOn(['part'])
            .where({
                target_id: targetId,
                target_type: targetType,
                status: TranslationStatus.Added
            })
            .select('part')
            .orderBy('part', 'ASC')
        const translations = await builder.execute()
        return translations.map(i => i.part)
    }

    async getTranslationsInGroup (group: string, pagination: PaginatedSorted): Promise<PaginatedResponse<Translation>> {
        return Translation.createQueryBuilder('tr')
            .where(':group = any(tr.groups)', { group })
            .paginate(pagination)
            .sort(pagination)
            .addSelectHidden()
            .getManyPaginated()
    }

    async getSingleTranslation (id: number, opts?: GetTranslationParameters): Promise<Translation | undefined> {
        const builder = Translation.createQueryBuilder('tr')
            .where({ id })

        if (opts?.needUploader) {
            builder.leftJoin('tr.uploader', 'user')
                .addSelect(['user.id', 'user.nickname', 'user.avatar'])
        }

        if (opts?.full) {
            builder.addSelectHidden()
        }

        return builder.getOne()
    }

    async addTranslations (translations: Partial<Translation>[]): Promise<number> {
        let total = 0

        for (let chunk of chunks(translations, 5000)) {
            const params = rowsToColumns(chunk)
            const result = await Translation.query(`select *
                                                    from translations_bulk_insert($1, $2, $3, $4, $5, $6, $7, $8, $9,
                                                                                  $10)`, [
                params.target_id,
                params.target_type,
                params.part,
                params.kind,
                params.lang,
                params.hq,
                params.author,
                params.url,
                // postgres is a bit weird >__<
                // maybe theres a cleaner solution but i spent entire
                // day searching for it without much progress
                params.groups.map(i => i.join('||')),
                params.status
            ])

            await TranslationNotifierQueue.addBulk(
                result
                    // so there are less useless items in queue
                    .filter(i => i.in_part === '1' || i.same_meta === '1')
                    .map(i => ({
                        name: 'notify-new',
                        data: {
                            translation: i
                        }
                    }))
            )

            total += result.length
        }

        return total
    }

    addATranslation (translation: Partial<Translation>): Promise<Translation> {
        return Translation.create(translation).save()
    }

    async notifyNewTranslation (translation: Translation): Promise<void> {
        await TranslationNotifierQueue.add('notify-new', {
            translation
        })
    }

    async modifyTranslation (id: number, edit: Partial<Translation>): Promise<void> {
        await Translation.update({ id }, edit)
    }

    async findTranslationWithSimilarUrl (url: string): Promise<number | null> {
        const it = await Translation.createQueryBuilder('t')
            .select(['t.id'])
            .where({ url }) // like/regex queries are extremely slow (5s or so, lol)
            .getOne()

        return it?.id ?? null
    }

    async findFullTranslationWithSimilarUrl (url: string): Promise<Translation | null> {
        const it = await Translation.createQueryBuilder('t')
            .addSelectHidden()
            .where({ url }) // like/regex queries are extremely slow (5s or so, lol)
            .getOne()

        return it ?? null
    }

    async assertNoDuplicates (url: string): Promise<void> {
        const duplicateId = await this.findTranslationWithSimilarUrl(url)
        if (duplicateId) ApiError.e(`TRANSLATION_DUPLICATE_${duplicateId}`, `Given translation seems to be a duplicate of ${duplicateId}`)
    }

    processTranslations (translations: Translation[], returnUrlType?: TranslationQueryExternalType): TranslationQueryResult {
        const ret: TranslationQueryResult = {}
        const index: Record<string, TranslationQueryAuthor> = {}

        // tags registry is a place where all tags are stored as a SortedArray for faster lookup
        // strings are compared by first N chars of in-array item, where N is length of requested item
        const tagsRegistry = new SortedArray<string>([], (a, b) => {
            if (a === b) return 0
            if (a.length === b.length) return a > b ? 1 : -1
            const substr = b.substr(0, a.length)
            if (a === substr) return 0
            return a > substr ? 1 : -1
        })

        translations.forEach((tr) => {
            const playerHost = this.getPlayerHost(tr.url)
            const optName = this.optimizeName(tr.author)

            this.normalizeTranslationUrl(tr, returnUrlType)

            // creating internal meta tag. user-submitted info is always
            // at the end, others params are sure not to have :,
            // so collisions of any kind aren't possible
            const metaTag = `${tr.part}:${tr.kind}:${tr.lang}:${optName}`

            // adding tag to registry if needed
            let tagIndex = tagsRegistry.index(metaTag)
            if (tagIndex === -1) {
                tagIndex = tagsRegistry.insert(metaTag)
            }

            // ensure current metaTag is longest
            if (metaTag.length > tagsRegistry.raw[tagIndex].length) {
                // first create a ref in index
                index[metaTag] = index[tagsRegistry.raw[tagIndex]]

                // then replace shorter boi with longer one.
                // sort order should not change since our tag
                // starts exactly as tag in sorted array
                tagsRegistry.raw[tagIndex] = metaTag
            }
            const fullTag = tagsRegistry.raw[tagIndex]

            // add part to ret if needed
            if (!(tr.part in ret)) {
                ret[tr.part] = {
                    players: [],
                    authors: []
                }
            }

            // ref to current episode
            const ep = ret[tr.part]
            if (!ep.players.includes(playerHost)) {
                ep.players.push(playerHost)
            }

            // adding author if needed
            if (!(fullTag in index)) {
                const author: TranslationQueryAuthor = {
                    kind: tr.kind,
                    lang: tr.lang,
                    name: tr.author,
                    translations: []
                }

                // adding in index
                index[fullTag] = author
                // adding in ret
                ep.authors.push(author)
            }

            // adding translation in ret.
            let item = {
                id: tr.id,
                name: playerHost,
                url: tr.url,
                hq: tr.hq,
                uploader: tr.uploader
            }
            if ('quality' in tr) {
                (item as any).quality = (tr as any).quality
            }
            index[fullTag].translations.push(item)
        })

        return ret
    }

    getPlayerHost (url: string): string {
        try {
            return new URL(url).hostname
        } catch (e) {
            throw Error('Invalid URL')
        }
    }

    optimizeName (name: string): string {
        if (name === '') {
            return 'unknown'
        }
        name = name.toLowerCase()
            .match(/^(.+?)(?:\s+[[(].+[\])]|\s+на\s+.+)?$/)![1]  // magic, dont touch
        if (name.indexOf(', ') !== -1 || name.indexOf(' & ') !== -1) {
            name = name.split(/(?:, | & )/)
                .sort()
                .join(', ')
            // if name is multiple names divided by comma or ampersand we sort them so the order does not matter
            // i.e. FooSub (Eva & Bob) is same as FooSub (Bob & Eva)
        }
        return name
    }

    compatAdapter (result: TranslationQueryResult): TranslationQueryResultCompat {
        const output = {}

        for (const i in result) {
            // eslint-disable-next-line no-prototype-builtins
            if (result.hasOwnProperty(i)) {
                output[i] = {
                    authors: {},
                    sources: result[i].players
                }
                result[i].authors.forEach((author) => {
                    if (!(author.name in output[i].authors)) {
                        output[i].authors[author.name] = []
                    }
                    output[i].authors[author.name].push(...author.translations.map((i) => {
                        return {
                            ...i,
                            kind: author.kind,
                            lang: author.lang,
                            author: author.name
                        }
                    }))
                })
            }
        }

        return output
    }

    normalizeTranslationUrl (translation: Translation, type?: TranslationQueryExternalType): Translation {
        if (!translation.url || translation.url[0] !== 'e') return translation

        if (type === TranslationQueryExternalType.RedirectPage) {
            translation.url = externalRedirectPage + encodeURIComponent(translation.url.substr(1))
        } else if (type === undefined) {
            translation.url = translation.url.substr(1)
        }

        return translation
    }

    getRecentUpdates (targetType: string): Promise<AtLeast<Translation, 'target_id' | 'part' | 'updated_at'>[]> {
        return Translation.find({
            where: {
                target_type: targetType,
                status: TranslationStatus.Added
            },
            select: ['target_id', 'part', 'updated_at'],
            order: {
                updated_at: 'DESC'
            },
            take: 20
        }).then((res) => uniqueBy(res, (tr) => tr.target_id + ',' + tr.part))
    }
}
