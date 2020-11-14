import { Body, Controller, Delete, Get, Param, Patch, Post, QueryParams, Session } from 'routing-controllers'
import { RequireFlag } from '@/decorators/auth-decorators'
import { ISession } from '@/middlewares/01_session'
import { SubmitTranslationBody } from '@/controllers/SubmissionController'
import { ModerationService } from '@/services/ModerationService'
import { TranslationService } from '@/services/TranslationService'
import { Translation, TranslationStatus } from '@/models/Translation'
import { merge, strip } from '@/helpers/object-utils'
import { ReportStatus } from '@/models/Report'
import { StatisticsQueue, TLoggerQueue } from '@/data/queues'
import { PartialBody } from '@/helpers/api-validate'
import { Endpoint } from '@/decorators/docs'
import { IsEnum, IsOptional } from 'class-validator'
import { Expose } from 'class-transformer'
import { UserService } from '@/services/UserService'
import { UpdateResult } from 'typeorm'
import { PushService } from '@/services/PushService'
import { AnyKV } from '@/types/utils'
import { ApiError, ApiValidationError } from '@/types/errors'
import { PaginatedSorted } from '@/types/api'
import { QueryParam } from 'routing-controllers/index'

class BatchPatchTranslationBody extends SubmitTranslationBody {
    @Expose()
    @IsOptional()
    @IsEnum(TranslationStatus)
    status?: TranslationStatus
}

@Endpoint({
    name: 'Moderation',
    description: 'Moderation-related endpoints'
})
@RequireFlag('moderator')
@Controller('/v2')
export default class ModerationController {
    moderationService = new ModerationService()
    translationService = new TranslationService()
    userService = new UserService()

    @Endpoint({
        name: 'Recent submissions/reports',
        description: 'Get a bunch of recent submissions/translations',
        params: {
            type: {
                type: '"submissions" | "reports"',
                description: 'Type of items to return'
            }
        },
        query: {
            $extends: 'Paginated',
            all: {
                type: 'boolean',
                description: 'Whether to return all submissions/reports and not only most recent (will remove '
                    + 'date filtering, does not affect pagination)'
            },
            complex: {
                type: 'boolean',
                description: 'If passed, will only return complex (if true) or non-complex (if false) reports. '
                    + 'If omitted, all reports are returned. Only used when <code>:type=reports</code>'
            }
        },
        returns: {
            type: 'PaginatedResponse<Translation[]> | PaginatedResponse<Report[]>',
            description: 'Depending on <code>type</code> will return different items.'
        }
    })
    @Get('/:type(submissions|reports)/recent')
    async getRecentSubmissionsOrReports (
        @Param('type') type: 'submissions' | 'reports',
        @QueryParams() params: PaginatedSorted,
        @QueryParam('all') all: boolean,
        @QueryParam('complex') complex?: boolean
    ) {
        if (type === 'submissions') {
            return this.moderationService.getSubmissions(params, !all)
        } else {
            return this.moderationService.getRecentReports(complex, params)
        }
    }


    @Endpoint({
        name: 'Process a submission',
        description: 'Accepts or declines a single submission',
        params: {
            id: {
                type: 'number',
                description: 'Submission ID'
            },
            action: {
                type: '"accept" | "decline"',
                description: 'Action'
            }
        },
        query: {
            reason: {
                type: 'string',
                description: 'In case <code>action</code> is <code>decline</code> - decline reason. Optional.'
            }
        },
        body: {
            type: 'Translation',
            partial: true
        },
        throws: [
            {
                type: 'TRANSLATION_DUPLICATE_N',
                description: 'Given translation is a duplicate of translation with id N. It may be in <code>pending</code> state. '
                    + 'Duplicates are detected by perfect url match'
            },
            {
                type: 'NOT_FOUND',
                description: 'Translation was not found'
            }
        ],
        returns: {
            type: 'Translation',
            description: 'Updated translation'
        }
    })
    @Post('/submissions/:id(\\d+)/:action(accept|decline)')
    async processSubmission (
        @Param('id') submissionId: number,
        @Param('action') action: 'accept' | 'decline',
        @QueryParams() params: AnyKV,
        @Body(PartialBody) body: SubmitTranslationBody,
        @Session() session: ISession
    ) {
        const translation = await this.translationService.getSingleTranslation(submissionId, { full: true })
        if (!translation)
            ApiError.e('NOT_FOUND')

        // we dont auto-fix urls here coz i trust moderators more than script

        // check for duplicates if url changed
        if (body.url) {
            await this.translationService.assertNoDuplicates(body.url)
        }

        if (action === 'accept') {
            merge(translation as any, body, ['id', 'uploader_id', 'status'], false, true)
        }

        translation.status = action === 'accept' ? TranslationStatus.Added : TranslationStatus.Declined

        await translation.save()

        if (action === 'decline' && params.reason) {
            await this.moderationService.setDeclineReason(translation.id, params.reason)
        }

        if (action === 'accept') {
            await this.translationService.notifyNewTranslation(translation)
        }

        StatisticsQueue.add('stat-event', {
            name: `moder-${action}:${session.userId}`
        })

        PushService.instance.deleteNotificationsWithTagDeferred(`mod-tr:${translation.id}`)

        return translation
    }

    @Endpoint({
        name: 'Get report',
        description: 'Get a single report',
        params: {
            id: {
                type: 'number',
                description: 'Report ID'
            }
        },
        returns: {
            type: 'Report | null',
            description: 'Requested report or null if it does not exist'
        }
    })
    @Get('/reports/:id(\\d+)')
    async getReport (
        @Param('id') reportId: number
    ) {
        return this.moderationService.getSingleReport(reportId, true)
    }

    @Endpoint({
        name: 'Process a report',
        description: 'Resolve a single report',
        params: {
            id: {
                type: 'number',
                description: 'Submission ID'
            },
            action: {
                type: '"discard" | "resolve" | "delete"',
                description: 'Action. If <code>discard</code> then report will me marked as discarded and nothing will happen. '
                    + 'If <code>delete</code> then report will be marked as resolved and corresponding translation will be deleted. '
                    + 'If <code>resolve</code> then report will be marked as resolved and corresponding translation will be updated from body.'
            }
        },
        body: {
            type: 'Translation',
            partial: true
        },
        throws: [
            {
                type: 'TRANSLATION_DUPLICATE_N',
                description: 'Given translation is a duplicate of translation with id N. It may be in <code>pending</code> state. '
                    + 'Duplicates are detected by perfect url match'
            },
            {
                type: 'ALREADY_PROCESSED',
                description: 'Report was already processed'
            }
        ],
        returns: {
            type: 'boolean'
        }
    })
    @Post('/reports/:id(\\d+)/:action(discard|resolve|delete)')
    async processReport (
        @Param('id') reportId: number,
        @Param('action') action: 'discard' | 'resolve' | 'delete',
        @Body(PartialBody) body: SubmitTranslationBody,
        @Session() session: ISession
    ) {
        const report = await this.moderationService.getSingleReport(reportId)
        if (report?.status !== ReportStatus.Pending)
            ApiError.e('ALREADY_PROCESSED', 'Report was already processed')

        // we dont auto-fix urls coz i trust moderators more than script

        let translation: Translation | undefined = undefined
        if (!report.is_complex) {
            translation = await this.translationService.getSingleTranslation(report.translation_id, { full: true })
            if (!translation) {
                // edge case, when translation was somehow else removed but report is still open.
                report.status = ReportStatus.Resolved
                await report.save()
                return true
            }
        }

        if (action === 'resolve') {
            // check for duplicates if url changed
            if (!report.is_complex) {
                if (body.url) {
                    await this.translationService.assertNoDuplicates(body.url)
                }

                TLoggerQueue.add('update', {
                    translation: { ...translation },
                    issuerId: session.userId,
                    reason: 'репорт ' + reportId,
                    diff: body
                })

                merge(translation as any, body, ['id', 'uploader_id', 'status'], false, true)

                await translation!.save()
            }

            report.status = ReportStatus.Resolved
        } else if (action === 'delete') {
            if (!report.is_complex) {
                TLoggerQueue.add('delete', {
                    translation,
                    issuerId: session.userId,
                    reason: 'репорт ' + reportId
                })

                StatisticsQueue.add('stat-event', {
                    name: `rep-proc:${session.userId}`
                })

                await translation!.remove()
            }
            report.status = ReportStatus.Resolved
        } else {
            report.status = ReportStatus.Discarded
        }

        report.closed_by_id = session.userId!

        StatisticsQueue.add('stat-event', {
            name: `tr-rem:user-${session.userId}`
        })

        await report.save()

        PushService.instance.deleteNotificationsWithTagDeferred(`mod-rp:${report.id}`)

        return true
    }

    @Endpoint({
        name: 'Make report complex',
        description: 'Make a report complex. Note that this action is irreversible!',
        params: {
            id: {
                type: 'number',
                description: 'Report ID'
            }
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Report was not found'
            },
            {
                type: 'TR_NOT_FOUND',
                description: 'Report is bound to a translation which does not exist'
            },
            {
                type: 'ALREADY_COMPLEX',
                description: 'Report is already complex'
            }
        ],
        returns: {
            type: '"OK"'
        }
    })
    @Get('/reports/:id(\\d+)/makeComplex')
    async makeReportComplex (
        @Param('id') reportId: number,
    ) {
        let report = await this.moderationService.getSingleReport(reportId)
        if (!report) ApiError.e('NOT_FOUND')

        await this.moderationService.makeReportComplex(report)

        return "OK"
    }

    @Endpoint({
        name: 'Batch update translations',
        description: 'Update multiple translations\' fields at once. '
            + 'Note that URLs and groups can\'t be changed here. '
            + 'Status can be changed, however, to batch hide translations without deleting them',
        query: {
            ids: {
                type: 'number[]',
                description: 'Comma-separated list of translation ids'
            },
            groups: {
                type: 'string[]',
                description: 'Comma-separated list of translation groups'
            }
        },
        returns: {
            type: 'object'
        }
    })
    @Patch('/translations')
    async updateBatch (
        @Body(PartialBody) body: BatchPatchTranslationBody,
        @QueryParams() params: AnyKV,
        @Session() session: ISession
    ) {
        body = strip(body, ['url', 'groups'])
        let result: UpdateResult
        if ('ids' in params) {
            let ids = params.ids.split(',').map(i => parseInt(i)).filter(i => !isNaN(i))
            result = await this.moderationService.updateTranslations(ids, body)
        } else if ('groups' in params) {
            let groups = params.groups.split(',').map(i => i.toLowerCase())
            result = await this.moderationService.updateTranslationsInGroup(groups, body)
        } else ApiValidationError.e('invalid query')

        StatisticsQueue.add('stat-event', {
            name: 'tr-edit:' + session.userId!,
            count: result.affected
        })

        return result
    }

    @Endpoint({
        name: 'Get translations in group',
        description: 'Returns all translations that belong to a given group',
        params: {
            group: {
                type: 'string',
                description: 'Group from which to receive translations.'
            }
        },
        query: {
            $extends: 'PaginatedSorted'
        },
        returns: {
            type: 'PaginatedResponse<Translation>'
        }
    })
    @Get('/translations/inGroup/:group(.+)')
    async getTranslationsInGroup (
        @Param('group') group: string,
        @QueryParams() query: PaginatedSorted
    ) {
        return this.translationService.getTranslationsInGroup(group, query)
    }

    @Endpoint({
        name: 'Get player meta information',
        description: 'Returns player meta information like title & page with player from some websites',
        params: {
            id: {
                type: 'number',
                description: 'Translation ID'
            }
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Translation was not found'
            }
        ],
        returns: {
            type: 'PlayerMeta'
        }
    })
    @Get('/translations/:id(\\d+)/playerMeta')
    async getPlayerMeta (
        @Param('id') id: number
    ) {
        const tr = await this.translationService.getSingleTranslation(id)
        if (!tr) ApiError.e('NOT_FOUND')

        return this.moderationService.getPlayerMeta(tr.url)
    }

    @Endpoint({
        name: 'Batch delete translations',
        description: 'Delete multiple translations at once',
        query: {
            ids: {
                type: 'number[]',
                description: 'Comma-separated list of translation ids'
            },
            groups: {
                type: 'string[]',
                description: 'Comma-separated list of translation groups'
            }
        },
        returns: {
            type: 'object'
        }
    })
    @Delete('/translations')
    async removeBatch (
        @QueryParams() params: AnyKV,
        @Session() session: ISession
    ) {
        if ('ids' in params) {
            let ids = params.ids.split(',').map(i => parseInt(i)).filter(i => !isNaN(i))
            const result = await this.moderationService.deleteTranslations(ids)

            StatisticsQueue.add('stat-event', {
                name: 'tr-rem:user-' + session.userId!,
                count: result.affected
            })

            return result
        } else if ('groups' in params) {
            let groups = params.groups.split(',').map(i => i.toLowerCase())
            const result = await this.moderationService.deleteTranslationsInGroup(groups)

            StatisticsQueue.add('stat-event', {
                name: 'tr-rem:group-' + groups.join(','),
                count: result.affected
            })

            return result
        } else ApiValidationError.e('invalid query')
    }

    @Endpoint({
        name: 'Get moderation statistics',
        description: 'Get number of accepted/declined translations and processed reports',
        query: {
            id: {
                type: 'number',
                description: 'User id to get statistics for. By default is current user. Usage requires Admin.'
            }
        },
        returns: {
            type: 'object',
            description: 'Object with fields: <code>accepted, declined, reports</code>, each maps to a single number.'
        }
    })
    @Get('/moderation/statistics')
    async getModerationStatistics (
        @QueryParams() params: AnyKV,
        @Session() session: ISession
    ) {
        let user = await this.userService.getUserById(session.userId!)
        if (!user) return null

        let userId = NaN
        if (user.admin && 'id' in params) {
            userId = parseInt(params.id)
        }
        if (isNaN(userId)) {
            userId = session.userId!
        }

        return this.moderationService.getModerationStatistics(userId)
    }
}
