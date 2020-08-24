import { Body, Controller, Ctx, Get, Param, Post, QueryParam, Session, UseBefore } from 'routing-controllers'
import { debugSecret, isProduction } from '@/config'
import { Context } from 'koa'
import { ApiError } from '@/types'
import { ISession } from '@/middlewares/01_session'
import { sleep } from '@/helpers/utils'
import { Notification } from '@/models/Notification'
import { RequireLogin } from '@/decorators/auth-decorators'
import { EntityConstructor } from '@/decorators/docs'
import { ParsersService } from '@/services/ParsersService'
import { TLoggerQueue } from '@/data/queues'
import { Parser } from '@/models/Parser'
import { LOG } from '@/helpers/logging'
import { Expose } from 'class-transformer'
import { IsArray, IsString } from 'class-validator'
import { Translation } from '@/models/Translation'

export async function debugChecker (ctx: Context, next: Function): Promise<void> {
    if (isProduction && ctx.get('X-Debug') !== debugSecret && ctx.query.dbg !== debugSecret) {
        ApiError.e('ACCESS_DENIED', 'You have no access to this method')
    }
    await next()
}

class RunCleanerBody {
    @Expose()
    @IsString({ each: true })
    @IsArray()
    provide: string[]

    @Expose()
    @IsString()
    code: string
}

@EntityConstructor({
    private: true
})
@UseBefore(debugChecker)
@Controller('/debug')
export default class DebugController {
    @Get('/session')
    getSession (
        @Session() session: ISession
    ) {
        return session
    }

    @Get('/session/destroy')
    destroySession (
        @Session() session: ISession
    ) {
        session.$destroy()
        return true
    }

    @Get('/echo')
    echo (@Ctx() ctx: Context) {
        return {
            headers: ctx.headers,
            query: ctx.query
        }
    }

    @Post('/echo')
    postEcho (@Ctx() ctx: Context) {
        return {
            headers: ctx.headers,
            query: ctx.query,
            body: ctx.body,
            rawBody: ctx.request.rawBody
        }
    }

    @RequireLogin()
    @Get('/push')
    async testPush (@Session() session: ISession) {
        await Notification.create({
            for_users: [session.userId!],
            payload: {
                type: 'notification',
                text: 'Hi this is a test notification'
            } as any
        }).send(true)

        return true
    }

    @RequireLogin()
    @Get('/push2')
    async testPush2 (@Session() session: ISession) {
        await Notification.create({
            deleted: false,
            for_users: [session.userId!],
            payload: {
                type: 'push',
                title: 'Finally! Water.',
                body: 'lorem ipsum dolor sit amet, consteeer oisauoiea oiawn,dsa mfasiwa mlasosalkdsalkjdsa khdsa asdkjsa dsakjhkj saskhjk hdsajkhjsakhds dhjkdsajksadljkdsalkj',
                image: 'https://shikimori.one/system/animes/original/30831.jpg',
                url: '$domain/anime/30831'
            } as any,
            progress: 1,
            time: new Date(),
            topics: []
        }).send()

        return true
    }

    @RequireLogin()
    @Get('/push3')
    async testPush3 (@Session() session: ISession) {
        await Notification.create({
            deleted: false,
            for_users: [session.userId!],
            payload: {
                type: 'silent-push',
                title: 'Finally! Water.',
                body: 'lorem ipsum dolor sit amet, consteeer oisauoiea oiawn,dsa mfasiwa mlasosalkdsalkjdsa khdsa asdkjsa dsakjhkj saskhjk hdsajkhjsakhds dhjkdsajksadljkdsalkj',
                image: 'https://shikimori.one/system/animes/original/30831.jpg',
                url: '$domain/anime/30831'
            } as any,
            progress: 1,
            time: new Date(),
            topics: []
        }).send()

        return true
    }

    @Get('/timeout')
    async timeout (@QueryParam('s') secs: number) {
        await sleep(isNaN(secs) ? 5000 : secs * 1000)
        return 'OK'
    }

    @Get('/run/:what(importers|mappers|cleaners)')
    async runParsers (
        @Param('what') what: 'importers' | 'mappers' | 'cleaners'
    ) {
        ParsersService.instance.runParsersGroup(what)

        return 'TASK_QUEUED'
    }

    @Get('/tg')
    async testTelegram () {
        TLoggerQueue.add('importers-run', {
            total: 42,
            perParserEfficiency: {
                'importers/test': 0.5,
                'importers/test1': 0.6667
            },
            perParserItems: {
                'importers/test': 2,
                'importers/test1': 3
            },
            perParserTotal: {
                'importers/test': 1,
                'importers/test1': 2
            }
        })

        return 'TASK_QUEUED'
    }

    @Post('/runCleaner')
    async runCleaner (
        @Body() body: RunCleanerBody
    ) {
        // js is so damn cool (no irony here, its really awesome)
        const dummyUid = 'cleaners/__test__running__cleaner__'

        const parser = new Parser()
        parser.uid = dummyUid
        parser.code = body.code
        parser.provide = body.provide


        await ParsersService.instance.loadDependencies(parser)
        const ctx = ParsersService.instance.getContextFor(parser, { Translation })
        ctx.debug = ctx.log

        for await (let id of ParsersService.instance.executeParser(parser, undefined, ctx)) {
            LOG.parsers.info('About to delete translation %d', id)
        }

        delete ParsersService.instance.cacheFunctions[dummyUid]
        delete ParsersService.instance.cacheParsers[dummyUid]

        return 'Finished, check backend console output.'
    }
}
