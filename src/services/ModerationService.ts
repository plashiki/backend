import normalizeUrl from 'normalize-url'
import { vkApi } from '@/external/vk'
import { User } from '@/models/User'
import { Notification } from '@/models/Notification'
import { Report } from '@/models/Report'
import { Translation, TranslationStatus } from '@/models/Translation'
import { Paginated, PaginatedResponse, PaginatedSorted } from '@/types'
import { DeleteResult, In, MoreThanOrEqual, Not, UpdateResult } from 'typeorm'
import { dropUndefined } from '@/helpers/object-utils'
import { KeyValue } from '@/models/KeyValue'
import { StatisticsDay } from '@/models/StatisticsDay'
import { resolveMeta, PlayerMeta } from '@/helpers/meta-resolvers'

export class ModerationService {
    async fixCommonUrlMistakes (url: string): Promise<string> {
        try {
            let m

            // vk - video link instead of embed link
            m = url.match(/^https?:\/\/vk\.com\/(?:.*?[?&]z=)?video(-?\d+?)_(\d+)(?:$|[?&])/)
            if (m) {
                const d = await vkApi('video.get', {
                    count: 1,
                    videos: m[0] + '_' + m[1]
                })
                if (d.count === 1) {
                    return normalizeUrl(d.items[0].player, {
                        removeQueryParameters: [/_*ref|api_hash/]
                    })
                } else return url
            }

            // sibnet - video link instead of embed link
            m = url.match(/^https?:\/\/video\.sibnet\.ru\/.*?video(\d+)(?:$|&|-)/)
            if (m) return 'https://video.sibnet.ru/shell.php?videoid=' + m[1]

            // https://smotret-anime-365.ru/catalog/tate-no-yuusha-no-nariagari-16693/1-seriya-184046/russkie-subtitry-2207540
            // (translation link instead of embed link)
            m = url.match(
                /^(https?:\/\/smotret-?anime(?:-?365)\.(?:ru|online))\/catalog\/[a-zA-Z-]+-\d+\/\d+-seriya-\d+\/[a-zA-Z-]+-(\d+)/)
            if (m) return `${m[1]}/translations/embed/${m[2]}`

            // myvi - video link instead of embed link
            m = url.match(/^(https?:\/\/(?:www\.)?myvi\.(?:top|tv))\/[a-zA-Z0-9]+?\?v=(.+)/)
            if (m) return `${m[1]}/embed/${m[2]}`

            // ok - same
            m = url.match(/^https?:\/\/ok\.ru\/video\/(\d+)/)
            if (m) return `https://ok.ru/videoembed/${m[1]}`

            return url
        } catch (e) {
            // bruh...
            return url
        }
    }

    async getPlayerMeta (url: string): Promise<PlayerMeta | null> {
        return resolveMeta(url)
    }

    async getModerators (): Promise<number[]> {
        return User.query('select id from users where moderator = true').then(it => it.map(i => i.id))
    }

    async getRecentSubmissions (pagination: PaginatedSorted): Promise<PaginatedResponse<Translation>> {
        return Translation.createQueryBuilder('tr')
            .where({
                // only return last week so queries are faster (we dont need to count all tr-s)
                updated_at: MoreThanOrEqual(new Date(Date.now() - 604800000)),
                status: Not(TranslationStatus.Mapping)
            })
            .leftJoin('tr.uploader', 'u')
            .addSelect(['u.id', 'u.nickname', 'u.avatar'])
            .paginate(pagination, 50)
            .sort(pagination, (b) => b
                .orderBy('status<>\'pending\'', 'ASC')
                .addOrderBy('updated_at', 'DESC')
            )
            .addSelectHidden()
            .getManyPaginated()
    }

    async getRecentReports (pagination: PaginatedSorted): Promise<PaginatedResponse<Report>> {
        return Report.createQueryBuilder('r')
            .leftJoinAndSelect('r.sender', 'u')
            .addSelect(['u.id', 'u.nickname', 'u.avatar'])
            .paginate(pagination, 50)
            .sort(pagination, (b) => b
                .orderBy('status<>\'pending\'', 'ASC')
                .addOrderBy('updated_at', 'DESC')
            )
            .getManyPaginated()
    }

    async notifyNewTranslation (translation: Translation, sender: User): Promise<void> {
        const targets = await User.findSubTargets(['mod:tr'], {
            moderator: true
        })

        Notification.create({
            for_users: targets,
            payload: {
                type: 'push',
                title: 'MOD_NEW_TR',
                body: 'MOD_NEW_TR_BODY',
                url: '$domain/moderation',
                format: {
                    mediaId: translation.target_id,
                    mediaType: translation.target_type,
                    part: translation.part,
                    kind: translation.kind,
                    lang: translation.lang,
                    sender: sender.nickname
                }
            } as any
        }).send()
    }

    async notifyNewReport (report: Report, sender: User): Promise<void> {
        const targets = await User.findSubTargets(['mod:rep'], {
            moderator: true
        })

        Notification.create({
            for_users: targets,
            payload: {
                type: 'push',
                title: 'MOD_NEW_REP',
                body: 'MOD_NEW_REP_BODY',
                url: '$domain/moderation',
                format: {
                    id: report.translation_id,
                    type: report.type,
                    sender: sender.nickname
                }
            } as any
        }).send()

    }

    createReport (params: Partial<Report>): Promise<Report> {
        return Report.create(params).save()
    }

    getUserSubmissions (userId: number, pagination: PaginatedSorted): Promise<PaginatedResponse<Translation>> {
        return Translation.createQueryBuilder('tr')
            .addSelect(['tr.status'])
            .where({
                uploader_id: userId
            })
            .paginate(pagination, 50)
            .sort(pagination, s => s.addOrderBy('tr.id', 'DESC'))
            .getManyPaginated()
    }

    getUserReports (userId: number, pagination: Paginated): Promise<PaginatedResponse<Report>> {
        return Report.createQueryBuilder('rp')
            .where({
                sender_id: userId
            })
            .paginate(pagination, 50)
            .orderBy('rp.id', 'DESC')
            .getManyPaginated()
    }

    getSingleReport (reportId: number, full = false): Promise<Report | null> {
        return Report.findOne({
            id: reportId
        }, full ? {
            relations: ['sender', 'translation', 'translation.uploader']
        } : undefined).then(it => it ?? null)
    }

    deleteTranslations (ids: number[]): Promise<DeleteResult> {
        return Translation.delete({
            id: In(ids)
        })
    }

    deleteTranslationsInGroup (groups: string[]): Promise<DeleteResult> {
        return Translation.createQueryBuilder()
            .delete()
            .where('groups && :groups', { groups })
            .execute()
    }

    updateTranslations (ids: number[], data: Partial<Translation>): Promise<UpdateResult> {
        return Translation.createQueryBuilder('tr')
            .update()
            .where({
                id: In(ids)
            })
            .set(dropUndefined(data))
            .execute()
    }

    updateTranslationsInGroup (groups: string[], data: Partial<Translation>): Promise<UpdateResult> {
        return Translation.createQueryBuilder('tr')
            .update()
            .where('tr.groups && :groups', { groups })
            .set(dropUndefined(data))
            .execute()
    }

    getDeclineReason (id: number): Promise<string | null> {
        // idk where to put it, xd
        return KeyValue.get('decline-reason:' + id, null)
    }

    setDeclineReason (id: number, reason: string): Promise<void> {
        return KeyValue.set('decline-reason:' + id, reason)
    }

    async getModerationStatistics (userId: number): Promise<Record<string, number>> {
        let d = await StatisticsDay.createQueryBuilder()
            .where('data->>(\'moder-accept:\' || :id) is not null', { id: userId })
            .orWhere('data->>(\'moder-decline:\' || $1) is not null')
            .orWhere('data->>(\'rep-proc:\' || $1) is not null')
            .getMany()
        let ret = {
            accepted: 0,
            declined: 0,
            reports: 0
        }

        d.forEach((day) => {
            Object.keys(day.data).forEach((key) => {
                if (key === 'moder-accept:' + userId) {
                    ret.accepted += day.data[key]
                }
                if (key === 'moder-decline:' + userId) {
                    ret.declined += day.data[key]
                }
                if (key === 'rep-proc:' + userId) {
                    ret.reports += day.data[key]
                }

            })
        })

        return ret
    }
}
