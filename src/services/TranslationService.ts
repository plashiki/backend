import { Translation, TranslationAuthor, TranslationStatus } from '@/models/Translation'
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
    async getTranslations (params: GetTranslationsParameters): Promise<any> {
        params = dropUndefined(params)

        if (Array.isArray(params.target_id)) {
            params.target_id = In(params.target_id)
        }

        let opts = {
            status: 'added',
            ...strip({ ...params }, ['raw', 'external', 'needUploader', 'renameAsAnime', 'fullAuthor'], true)
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
                    i.quality = 'tv'

                    return i
                }) as any
            }

            if (!('fullAuthor' in params)) {
                items = items.map((it) => {
                    (it as any).author = this.authorToString(it.author)
                    return it
                })
            }

            if (params.external !== TranslationQueryExternalType.Protocol) {
                items = items.map((i) => this.normalizeTranslationUrl(i, params.external))
            }

            return items as any
        } else {
            if (params.renameAsAnime) {
                // compat with anime api v1/v2
                items = items.map((i: AnyKV) => {
                    i.quality = 'tv'
                    return i
                }) as any
            }

            return this.processTranslations(items, params)
        }
    }

    processTranslations (
        translations: Translation[],
        params: GetTranslationsParameters
    ): TranslationQueryResult {
        const ret: TranslationQueryResult = {}

        const peopleCombiner: Record<number, Record<string, string[]>> = {}
        const authorsIndex: Record<number, Record<string, TranslationQueryAuthor>> = {}

        translations.forEach((tr) => {
            const playerHost = this.getPlayerHost(tr.url)
            this.normalizeTranslationUrl(tr, params.external)

            const groupLowercase = tr.author.group?.toLowerCase() ?? ''
            const hasGroup = !!tr.author.group
            let people: string[] = tr.author.people || []
            if (hasGroup) {
                if (!(tr.part in peopleCombiner)) peopleCombiner[tr.part] = {}
                if (!(tr.author.group! in peopleCombiner[tr.part])) peopleCombiner[tr.part][groupLowercase] = []
                tr.author.people?.forEach((it) => {
                    if (peopleCombiner[tr.part][groupLowercase].indexOf(it) === -1) {
                        peopleCombiner[tr.part][groupLowercase].push(it)
                    }
                })

                people = peopleCombiner[tr.part][groupLowercase]
            }

            const authorName = tr.author.group || tr.author.people?.join(', ') || ''
            const metaTag = `${tr.kind}:${tr.lang}:${authorName.toLowerCase()}`

            // add part to ret if needed
            if (!(tr.part in ret)) {
                ret[tr.part] = {
                    players: [],
                    authors: []
                }
            }

            // ref to current part
            const part = ret[tr.part]
            if (!part.players.includes(playerHost)) {
                part.players.push(playerHost)
            }

            if (!(tr.part in authorsIndex)) authorsIndex[tr.part] = {}
            if (!(metaTag in authorsIndex[tr.part])) {
                const author: TranslationQueryAuthor = {
                    kind: tr.kind,
                    lang: tr.lang,
                    translations: [],
                    name: authorName
                }
                if (tr.author.people) author.people = people

                // adding in index
                authorsIndex[tr.part][metaTag] = author
                // adding in ret
                part.authors.push(author)
            }

            // adding translation in ret.
            let item: any = {
                id: tr.id,
                name: playerHost,
                url: tr.url,
                uploader: tr.uploader
            }
            if ('quality' in tr) {
                item.quality = (tr as any).quality
            }
            if (tr.author.ripper) {
                item.ripper = tr.author.ripper
            }
            authorsIndex[tr.part][metaTag].translations.push(item)
        })

        return ret
    }

    async getAvailableParts (targetId: number, targetType: MediaType, include365: boolean): Promise<number[]> {
        const builder = Translation.createQueryBuilder('t')
            .distinctOn(['part'])
            .where({
                target_id: targetId,
                target_type: targetType,
                status: TranslationStatus.Added
            })
        if (!include365) {
            builder.andWhere('url not like \'https://smotret-anime.online%\'')
        }

        builder.select('part')
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
            const result = await Translation.query('select * from translations_bulk_insert($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
                params.target_id,
                params.target_type,
                params.part,
                params.kind,
                params.lang,
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

    getPlayerHost (url: string): string {
        try {
            return new URL(url).hostname
        } catch (e) {
            throw Error('Invalid URL')
        }
    }

    parseTranslationAuthor (author: string): TranslationAuthor {
        if (!author) return {}
        let match = author.match(/^(.+?)(?:\s+[[(](.+)[\])]|\s+на\s+.+)?$/) // holy fuck

        if (!match) return {
            group: author
        }

        let [, group, people] = match

        if (group.match(/[,;]|\s[и&]\s/)) {
            people = group
            group = ''
        }

        return {
            group,
            people: people?.split(/[,;]|\s[и&]\s/gi).map(i => i.trim()) ?? []
        }
    }

    authorToString (author: TranslationAuthor): string {
        let ret = ''
        if (author.group) {
            ret = author.group
            if (author.people?.length) {
                ret += ` (${author.people.join(', ')})`
            }
        } else if (author.people?.length) {
            ret = author.people.join(', ')
        } else return ''

        if (author.ripper) {
            ret += ` [${author.ripper}]`
        }

        return ret
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
                    if (!(author.name! in output[i].authors)) {
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
