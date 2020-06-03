import { Body, Controller, Ctx, Get, Param, Post, QueryParams, Session } from 'routing-controllers'
import { Endpoint } from '@/decorators/docs'
import { ParsersService } from '@/services/ParsersService'
import { AnyKV, ApiError } from '@/types'
import { RequireServerScope, requireServerScope } from '@/decorators/auth-decorators'
import { ISession } from '@/middlewares/01_session'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Parser } from '@/models/Parser'
import rateLimitMiddleware from '@/middlewares/rate-limit'
import { Context } from 'koa'


class ParsersPullBody {
    @Expose()
    @IsString({ each: true })
    hashes: string[]
}

class ParsersPushBody {
    @Expose()
    @IsOptional()
    @Type(() => Parser)
    @IsArray()
    @ValidateNested({
        each: true,
        partial: true
    })
    upsert?: Parser[]

    @Expose()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    delete?: string[]
}


@Endpoint({
    name: 'Parsers',
    description: 'Advanced low-level and high-trusted endpoints that interact directly ' +
        'with server internal entities called <a href="/entities/#enitity-parser">Parsers</a>. ' +
        'All of these require a specific <a href="/#protected-resources">server scope</a>. '
})
@Controller('/v2/parsers')
export default class ParsersController {
    service = ParsersService.instance

    @Endpoint({
        name: 'Run a Parser',
        description: 'Run a parser using given parameters. Requires <code>parsers:run:$UID</code> ' +
            'server scope, where <code>$UID</code> is a parser UID for non-public parsers. Note that result of a parser will not be ' +
            'interpreted internally. So, Importers will either return <code>{}</code> (in case of a generator) or ' +
            'array of items, and they WILL NOT be actually imported',
        params: {
            uid: {
                type: 'string',
                description: 'UID of a Parser'
            }
        },
        query: {
            $key: {
                type: 'any',
                description: 'All query parameters will be passed as-is to the Parser'
            }
        },
        checks: [
            {
                name: 'server-scope',
                params: {
                    scope: 'parsers:run:$UID'
                }
            }
        ],
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Parser was not found'
            }
        ],
        returns: {
            type: 'any',
            description: 'A parser can contain anything, so return type is unknown'
        }
    })
    @Get('/run/:uid(.+)')
    async runParser (
        @Param('uid') uid: string,
        @QueryParams() params: AnyKV,
        @Session() session: ISession,
        @Ctx() ctx: Context
    ) {
        const parser = await this.service.getParserAndLoadDependencies(uid)
        if (!parser) ApiError.e('NOT_FOUND')

        if (!parser.public) {
            await requireServerScope(session, `parsers:run:${uid.replace(/\//g, ':')}`)
        } else if (parser.public !== 'true') {
            let [requests, duration] = parser.public.split(',')
            await new Promise(
                (resolve, reject) => Promise.resolve()
                    .then(() => rateLimitMiddleware(parseInt(requests), parseInt(duration), `parsers:${uid}//`)(ctx, resolve as any))
                    .catch(reject)
            )
        }

        return this.service.executeParser(parser, params)
    }

    @Endpoint({
        name: 'Pull parsers',
        description: 'Get parsers difference since last pull.',
        body: {
            type: 'ParsersPullBody',
            description: 'Parser revisions (hashes) that are already present.'
        },
        returns: {
            type: 'Parser[]'
        }
    })
    @RequireServerScope('parsers:pull')
    @Post('/pull')
    async pullParsers (
        @Body() body: ParsersPullBody
    ) {
        return this.service.pullParsers(body.hashes)
    }

    @Endpoint({
        name: 'Push parsers',
        description: 'Update parsers on server. Note that client should do ' +
            'caching and push only parsers that were actually changed. Not like its required, but ' +
            'it\'ll probably greatly reduce server load',
        body: {
            type: 'ParsersPushBody',
            description: 'Parser updates. Hashes will be calculated automatically, ' +
                'source code will be gzipped automatically as well'
        },
        returns: {
            type: '"OK"'
        }
    })
    @RequireServerScope('parsers:push')
    @Post('/push')
    async pushParsers (
        @Body() body: ParsersPushBody
    ) {
        if (body.delete && body.delete.length) {
            await this.service.deleteParsers(body.delete)
        }

        if (body.upsert && body.upsert.length) {
            await this.service.pushParsers(body.upsert)
        }

        return 'OK'
    }
}
