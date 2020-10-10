import { Body, Controller, Get, Post, Session } from 'routing-controllers'
import { IsArray, IsEnum, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator'
import { ISession } from '@/middlewares/01_session'
import { verifyCaptchaOrReject } from '@/helpers/recaptcha'
import RateLimit from '@/decorators/rate-limit'
import { Expose, Type } from 'class-transformer'
import { Endpoint } from '@/decorators/docs'
import { RequireServerScope } from '@/decorators/auth-decorators'
import { SubmitTranslationBody } from '@/controllers/SubmissionController'
import { TranslationStatus } from '@/models/Translation'
import { uniqueBy } from '@/helpers/object-utils'
import { TranslationService } from '@/services/TranslationService'

class CaptchaRefreshBody {
    @Expose()
    @IsString()
    token: string
}

class ExternalBatchAdditionItem extends SubmitTranslationBody {
    @Expose()
    @IsString({ each: true })
    @IsArray()
    @IsOptional()
    groups?: string[]

    @Expose()
    @IsEnum(TranslationStatus)
    @IsOptional()
    status?: TranslationStatus

    @Expose()
    @IsUrl({
        protocols: ['https', 'ehttp', 'ehttps']
    })
    url: string
}

class ExternalBatchAdditionBody {
    @Expose()
    @ValidateNested({ each: true })
    @IsArray()
    @Type(() => ExternalBatchAdditionItem)
    translations: ExternalBatchAdditionItem[]
}


@Endpoint({
    name: 'Internal',
    description: 'Endpoints which are intended for internal usage'
})
@Controller()
export default class InternalsController {
    translationService = new TranslationService()

    @Endpoint({
        name: 'Ping',
        description: 'Ping!',
        returns: {
            type: '"Pong"'
        }
    })
    @Get('/ping')
    ping () {
        return 'Pong'
    }

    @Endpoint({
        name: 'Captcha',
        description: 'Refresh user\'s last captcha time',
        body: {
            type: 'object',
            fields: {
                token: {
                    type: 'string',
                    description: 'Recaptcha token'
                }
            }
        },
        throws: [
            {
                type: 'Captcha verification failed',
                description: 'Thrown when invalid Recaptcha token passed'
            }
        ],
        returns: {
            type: 'boolean'
        }
    })
    @Post('/internal/captcha')
    @RateLimit(5, 60, 'captcha/') // idk who may want to flood in here but no
    async refreshCaptcha (
        @Session() session: ISession,
        @Body() body: CaptchaRefreshBody
    ) {
        await verifyCaptchaOrReject(body.token)

        const now = Date.now()

        if (session.$oauth) {
            session.$oauth.captcha = now
            await session.$oauth.save()
        } else {
            session.captcha = now
            session.$save()
        }

        return true
    }

    @Endpoint({
        name: 'External batch addition',
        description: 'Batch addition for multiple translations at once as an external OAuth app. '
            + 'The only limit is bodyparser body limit (around 1mb), so with minification that\'s about 4k translations at once.<br />'
            + 'You can access extended number of parameters, including <code>groups</code>'
            + '<code>status</code>. Use status=pending to put items on pre-moderation, status=declined will be ignored.<br />'
            + 'Group <code>from-app:[your-app-id]</code> will always be added with your translations as a precaution.'
    })
    @Post('/batch/add/translations')
    @RequireServerScope('batch:add:translation')
    async externalBatchAddition (
        @Body() body: ExternalBatchAdditionBody,
        @Session() session: ISession
    ) {
        const translations = body.translations
            .filter(i => i.status !== TranslationStatus.Declined)
            .map(i => ({
                target_id: i.target_id,
                target_type: i.target_type,
                part: i.part,
                kind: i.kind,
                lang: i.lang,
                author: i.author,
                url: i.url,
                groups: uniqueBy([...(i.groups ?? []), 'from-app:' + session.$app!.id]),
                status: i.status ?? TranslationStatus.Added
            }))

        const added = await this.translationService.addTranslations(translations)

        return {
            added
        }
    }
}
