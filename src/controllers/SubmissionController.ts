import { Body, Controller, Delete, Get, Param, Post, QueryParams, Session } from 'routing-controllers'
import { UserService } from '@/services/UserService'
import { TranslationService } from '@/services/TranslationService'
import { ISession } from '@/middlewares/01_session'
import { RequireLogin } from '@/decorators/auth-decorators'
import { CaptchaProtected } from '@/helpers/recaptcha'
import { ApiError, MediaType, Paginated, PaginatedSorted } from '@/types'
import { IsNumeric } from '@/helpers/validators'
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator'
import { TranslationKind, TranslationLanguage, TranslationStatus } from '@/models/Translation'
import normalizeUrl from 'normalize-url'
import { ModerationService } from '@/services/ModerationService'
import { ReportStatus, ReportType } from '@/models/Report'
import { merge, shallowMerge } from '@/helpers/object-utils'
import { PartialBody } from '@/helpers/api-validate'
import { Expose, Type } from 'class-transformer'
import { StatisticsQueue, TLoggerQueue } from '@/data/queues'
import { Endpoint, EntityConstructor } from '@/decorators/docs'

export class SubmitTranslationBody {
    @Expose()
    @IsNumeric()
    target_id: number

    @Expose()
    @IsEnum(MediaType)
    target_type: MediaType

    @Expose()
    @IsNumeric({ min: 1 })
    part: number

    @Expose()
    @IsEnum(TranslationKind)
    kind: TranslationKind

    @Expose()
    @IsEnum(TranslationLanguage)
    lang: TranslationLanguage

    @Expose()
    @IsBoolean()
    hq: boolean

    @Expose()
    @IsString()
    author: string

    @Expose()
    @IsUrl({
        protocols: ['https']
    })
    url: string
}

@EntityConstructor({
    description: 'Request body for New report'
})
export class SubmitReportBody {
    @Expose()
    @IsNumeric()
    translation_id: number

    @Expose()
    @IsEnum(ReportType)
    type: ReportType

    @Expose()
    @IsString()
    @MaxLength(1000)
    comment: string

    @Expose()
    @ValidateNested({ partial: true })
    @Type(() => SubmitTranslationBody)
    @IsOptional()
    edit?: Partial<SubmitTranslationBody>
}

@Endpoint({
    name: 'Submissions & reports',
    description: 'Control user submissions & reports'
})
@RequireLogin()
@Controller('/v2')
export default class SubmissionController {
    userService = new UserService()
    translationService = new TranslationService()
    moderationService = new ModerationService()

    @Endpoint({
        name: 'New submission',
        description: 'Submit a new translation. If user is marked as <code>trusted</code> or <code>moderator</code> it will be immediately added, otherwise queued for moderators to check.',
        body: {
            type: 'SubmitTranslationBody',
            description: 'Translation to be submitted. Must contain all Translation fields (except service ones like id, uploader_id, groups, status, created_at & updated_at)'
        },
        returns: {
            type: 'Translation',
            description: 'To detect whether the translation was added, check for <code>.status</code> field. If it is <code>added</code>, then translation was added'
        },
        throws: [
            {
                type: 'TRANSLATION_DUPLICATE_N',
                description: 'Given translation is a duplicate of translation with id N. It may be in <code>pending</code> state. '
                    + 'Duplicates are detected by perfect url match'
            },
            {
                type: 'BANNED',
                description: 'User was banned from sending translations'
            }
        ]
    })
    @Post('/submit/new')
    @CaptchaProtected(72000000)
    async submitTranslation (
        @Body() body: SubmitTranslationBody,
        @Session() session: ISession
    ) {
        const user = await this.userService.getUserById(session.userId!)
        if (!user) ApiError.e('USER_UNKNOWN')

        if (user.banned) ApiError.e('BANNED', 'You are not allowed to submit translations.')

        let url = await this.moderationService.fixCommonUrlMistakes(body.url)
        url = normalizeUrl(url, {
            defaultProtocol: 'https',
            forceHttps: true,
            normalizeProtocol: true,
            sortQueryParameters: true
        })
        body.url = url

        await this.translationService.assertNoDuplicates(body.url)

        let translation = await this.translationService.addATranslation({
            ...body,
            uploader_id: session.userId!,
            status: (user.trusted || user.moderator) ? TranslationStatus.Added : TranslationStatus.Pending,
            groups: undefined  // discarding in case client sent
        })

        if (user.trusted || user.moderator) {
            StatisticsQueue.add('stat-event', {
                name: `tr-added:user-${user.id}`
            })

            await this.translationService.notifyNewTranslation(translation)
        } else {
            StatisticsQueue.add('stat-event', {
                name: `moder-new:${user.id}`
            })
            TLoggerQueue.add('moder-new', {
                translation,
                issuerId: user.id
            })

            await this.moderationService.notifyNewTranslation(translation, user)
        }

        return translation
    }

    @Endpoint({
        name: 'New report',
        description: 'Submit a new report. If user is marked as <code>moderator</code> and there is <code>edit</code> it will be automatically processed, otherwise queued for moderators to check.',
        body: {
            type: 'SubmitReportBody',
            description: 'Translation to be submitted. Must contain all Report fields (except service ones like id, sender_id, status, created_at & updated_at)'
        },
        returns: {
            type: 'Report'
        },
        throws: [
            {
                type: 'BANNED',
                description: 'User was banned from sending translations'
            },
            {
                type: 'NOT_FOUND',
                description: 'Translation with given translation_id does not exist'
            }
        ]
    })
    @Post('/submit/report')
    @CaptchaProtected(7200000)
    async submitReport (
        @Body() body: SubmitReportBody,
        @Session() session: ISession
    ) {
        const user = await this.userService.getUserById(session.userId!)
        if (!user) ApiError.e('USER_UNKNOWN')

        if (user.banned) ApiError.e('BANNED', 'You are not allowed to submit reports.')

        const tran = await this.translationService.getSingleTranslation(body.translation_id)
        if (!tran) ApiError.e('NOT_FOUND', 'Translation does not exist')

        const report = await this.moderationService.createReport({
            sender_id: session.userId!,
            type: body.type,
            comment: body.comment,
            status: user.moderator && body.edit ? ReportStatus.Resolved : ReportStatus.Pending,
            edit: body.edit,
            translation_id: body.translation_id
        })

        if (user.moderator && body.edit) {
            merge(tran, body.edit)
            await tran.save()
        } else {
            TLoggerQueue.add('rep-new', {
                report,
                issuerId: user.id
            })

            await this.moderationService.notifyNewReport(report, user)
        }

        return report
    }

    @Endpoint({
        name: 'Get submissions',
        description: 'Get a bunch of recent submissions',
        query: {
            $extends: 'PaginatedSorted'
        },
        returns: {
            type: 'PaginatedResponse<Translation[]>'
        }
    })
    @Get('/submissions')
    getSubmissions (
        @Session() session: ISession,
        @QueryParams() params: PaginatedSorted
    ) {
        return this.moderationService.getUserSubmissions(session.userId!, params)
    }


    @Endpoint({
        name: 'Get reports',
        description: 'Get a bunch of recent reports',
        query: {
            $extends: 'Paginated'
        },
        returns: {
            type: 'PaginatedResponse<Report[]>'
        }
    })
    @Get('/reports')
    getReports (
        @Session() session: ISession,
        @QueryParams() params: Paginated
    ) {
        return this.moderationService.getUserReports(session.userId!, params)
    }

    @Endpoint({
        name: 'Update submission',
        description: 'Update sent submission. Will result in error if translation is already processed and user is not a moderator.',
        params: {
            id: {
                type: 'number',
                description: 'Submission id to be updated'
            }
        },
        body: {
            type: 'Translation',
            partial: true,
            description: 'Fields to be updated in submission'
        },
        returns: {
            type: 'Translation[]'
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Submission was not found'
            },
            {
                type: 'ALREADY_PROCESSED',
                description: 'Submission was already processed'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'You can only update own submissions'
            }
        ]
    })
    @Post('/translations/:id(\\d+)')
    async patchTranslation (
        @Param('id') translationId: number,
        @Body(PartialBody) body: SubmitTranslationBody,
        @Session() session: ISession
    ) {
        const user = await this.userService.getUserById(session.userId!)
        if (!user) ApiError.e('UNKNOWN_USER')

        const translation = await this.translationService.getSingleTranslation(translationId, { full: true })
        if (!translation) ApiError.e('NOT_FOUND', 'Submission was not found')
        if (!user.moderator) {
            if (translation.status !== TranslationStatus.Pending)
                ApiError.e('ALREADY_PROCESSED', 'Submission was already processed')
            if (translation.uploader_id !== session.userId!)
                ApiError.e('ACCESS_DENIED', 'You can only update own submissions')
        }

        let ignoredFields = ['id', 'uploader_id', 'status']
        if (!user.moderator) {
            ignoredFields.push('groups')
        }

        // check for duplicates if url changed
        if (body.url) {
            await this.translationService.assertNoDuplicates(body.url)
        }

        shallowMerge(translation, body, ignoredFields)

        await translation.save()

        if (user.moderator && translation.uploader_id !== session.userId) {
            TLoggerQueue.add('update', {
                translation,
                issuerId: session.userId,
                diff: body
            })

            StatisticsQueue.add('stat-event', {
                name: `tr-edit:${session.userId}`
            })
        }

        return user.moderator ? translation : translation.stripHidden()
    }

    @Endpoint({
        name: 'Delete a report',
        description: 'Delete sent report. Will result in error if report is already resolved.',
        params: {
            id: {
                type: 'number',
                description: 'Report id to be deleted'
            }
        },
        returns: {
            type: '"OK"'
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Report was not found'
            },
            {
                type: 'ALREADY_PROCESSED',
                description: 'Report was already processed'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'You can only delete own reports'
            }
        ]
    })
    @Delete('/reports/:id(\\d+)')
    async deleteReport (
        @Param('id') reportId: number,
        @Session() session: ISession
    ) {
        const report = await this.moderationService.getSingleReport(reportId)
        if (!report) ApiError.e('NOT_FOUND', 'Report was not found')

        if (report.status !== ReportStatus.Pending)
            ApiError.e('ALREADY_PROCESSED', 'Report was already processed')
        if (report.sender_id !== session.userId!)
            ApiError.e('ACCESS_DENIED', 'You can only delete own reports')

        await report.remove()

        return 'OK'
    }

    @Endpoint({
        name: 'Delete a submission',
        description: 'Delete sent submission. Will result in error if submission is already processed and user is not a moderator.',
        params: {
            id: {
                type: 'number',
                description: 'Submission id to be deleted'
            }
        },
        returns: {
            type: '"OK"'
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Report was not found'
            },
            {
                type: 'ALREADY_PROCESSED',
                description: 'Report was already processed'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'You can only delete own reports'
            }
        ]
    })
    @Delete('/translations/:id(\\d+)')
    async deleteTranslation (
        @Param('id') translationId: number,
        @Session() session: ISession
    ) {
        const user = await this.userService.getUserById(session.userId!)
        if (!user) ApiError.e('UNKNOWN_USER')

        const translation = await this.translationService.getSingleTranslation(translationId, { full: true })
        if (!translation) ApiError.e('NOT_FOUND', 'Translation does not exist')

        if (!user.moderator) {
            if (translation.status !== TranslationStatus.Pending)
                ApiError.e('ALREADY_PROCESSED', 'Translation was already processed')
            if (translation.uploader_id !== session.userId!)
                ApiError.e('ACCESS_DENIED', 'You can only delete own submissions')
        }

        await translation.remove()

        if (user.moderator && translation.uploader_id !== user.id) {
            TLoggerQueue.add('delete', {
                translation,
                issuerId: session.userId
            })
            StatisticsQueue.add('stat-event', {
                name: `tr-rem:user-${user.id}`
            })
        }

        return 'OK'
    }

    @Endpoint({
        name: 'Get decline reason',
        description: 'In case a submission was declined, chances are that moderator set a reason of rejection.',
        params: {
            id: {
                type: 'number',
                description: 'Submission id to be deleted'
            }
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Translation was not found'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'You can only get decline reason for own submissions'
            },
            {
                type: 'NOT_DECLINED',
                description: 'This translation was not declined.'
            }
        ]
    })
    @Get('/translations/:id(\\d+)/declineReason')
    async getDeclineReason (
        @Param('id') translationId: number,
        @Session() session: ISession
    ) {
        const user = await this.userService.getUserById(session.userId!)
        if (!user) ApiError.e('UNKNOWN_USER')

        const translation = await this.translationService.getSingleTranslation(translationId, { full: true })
        if (!translation) ApiError.e('NOT_FOUND', 'Translation does not exist')

        if (translation.uploader_id !== session.userId! && !user.moderator)
            ApiError.e('ACCESS_DENIED', 'You can only get decline reason for own submissions')

        if (translation.status !== TranslationStatus.Declined) {
            ApiError.e('NOT_DECLINED')
        }

        return this.moderationService.getDeclineReason(translationId)
    }
}
