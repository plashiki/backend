import IORedis from 'ioredis'
import { Parser } from '@/models/Parser'
import { AnyKV, AtLeast, ExternalServiceMappings, MediaType } from '@/types'
import { libs } from '@/vendor/parsers-libs'
import { getDebugger } from '@/helpers/debug'
import * as config from '@/config'
import redis from '@/data/redis'
import { In, Not } from 'typeorm'
import zlib from 'zlib'
import { promisify } from 'util'
import { createHash } from 'crypto'
import { generateOnConflictStatement } from '@/helpers/utils'
import { chunks, createIndex, shallowMerge } from '@/helpers/object-utils'
import { ChildProcess, fork } from 'child_process'
import { join } from 'path'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

const conflictStatement = generateOnConflictStatement(
    ['uid'],
    ['disabled', 'cri', 'code', 'provide', 'hash', 'source']
)

export interface MapperResult {
    mappings: ExternalServiceMappings
    type: MediaType
}

export class ParsersService {
    static REDIS_CHANNEL = 'plashiki-parsers'
    private static __instance: ParsersService
    sub: IORedis.Redis
    cacheParsers: Record<string, Parser> = {}
    cacheFunctions: Record<string, Function> = {}
    // separate process for CRI-s
    criProcess: ChildProcess | null = null
    // separate process for Parsers (importers/mappers)
    parsersProcess: ChildProcess | null = null

    private constructor () {
        this.sub = new IORedis()
        this.sub.subscribe(ParsersService.REDIS_CHANNEL)
            .then(() => {
                this.sub.on('message', (chan, msg) => {
                    if (chan === ParsersService.REDIS_CHANNEL) {
                        msg = JSON.parse(msg)
                        return this.__handleMessage(msg)
                    }
                })
            })
    }

    public static get instance (): ParsersService {
        if (!ParsersService.__instance) {
            ParsersService.__instance = new ParsersService()
        }

        return ParsersService.__instance
    }

    startCriProcess (): void {
        if (this.criProcess) {
            this.criProcess.kill()
        }

        this.criProcess = fork(join(__dirname, '../workers/cri.js'))
    }

    startParsersProcess (): void {
        if (this.parsersProcess) {
            this.parsersProcess.kill()
        }

        this.parsersProcess = fork(join(__dirname, '../workers/parsers.js'))
    }

    runParsersGroup (group: string): void {
        if (!this.parsersProcess) {
            this.startParsersProcess()
        }

        this.parsersProcess!.send({
            act: `run-${group}`
        })
    }

    loadDependencies (
        parser: Parser,
        visited: Record<string, boolean> = {}
    ): void {
        if (this.cacheFunctions[parser.uid]) return
        visited[parser.uid] = true
        parser.provide.forEach((uid) => {
            if (!parser.dependencies) {
                parser.dependencies = {}
            }
            if (!parser.dependencies[uid] && !visited[uid]) {
                parser.dependencies[uid] = this.cacheParsers[uid]
                this.loadDependencies(this.cacheParsers[uid], visited)
            }
        })

        this.cacheFunctions[parser.uid] =
            new Function(parser.code)()

        visited[parser.uid] = false
    }

    // no type because i dont feel like copying it from other repo.
    getContextFor (parser: Parser, params?: AnyKV, parent?: Parser, rootCtx?: any): any {
        const ctx = {
            __stat: 0,
            params,
            libs,
            log: getDebugger(`parser:${(parent ?? parser).uid}`),
            debug: () => {
                // no-op //
            },
            deps: {} as AnyKV,
            config,
            rootUid: (parent ?? parser).uid,
            uid: parser.uid,
            stat (n = 1): void {
                if (rootCtx) {
                    rootCtx.__stat += n
                } else {
                    ctx.__stat += n
                }
            }
        } as any

        parser.provide.forEach((uid) => {
            const dep = this.cacheParsers[uid]
            const fun = this.cacheFunctions[uid]
            if (!dep || !fun) {
                Object.defineProperty(ctx.deps, uid, {
                    get () {
                        throw new Error(`Dependency not found: ${uid}`)
                    }
                })
            } else {
                Object.defineProperty(ctx.deps, uid, {
                    value: fun(this.getContextFor(dep, params, parent ?? parser, rootCtx ?? ctx)),
                    configurable: false
                })
            }
        })

        return ctx
    }

    executeParser (parser: Parser, params?: AnyKV, ctx = this.getContextFor(parser, params)): any {
        if (!this.cacheFunctions[parser.uid]) {
            if (!parser) {
                throw new Error('Parser is not loaded!')
            }
        }

        return this.cacheFunctions[parser.uid](ctx)
    }

    async executeParserByUid (uid: string, params?: AnyKV): Promise<any> {
        const parser = await this.getParserAndLoadDependencies(uid)
        if (!parser) {
            throw new Error('Parser does not exist: ' + uid)
        }

        return this.executeParser(parser, params)
    }

    async getParserAndLoadDependencies (rootUid: string): Promise<Parser | null> {
        if (this.cacheParsers[rootUid]) {
            if (!this.cacheFunctions[rootUid]) {
                this.loadDependencies(this.cacheParsers[rootUid])
            }
            return this.cacheParsers[rootUid]
        }

        await this.loadParsers([rootUid])

        return this.cacheParsers[rootUid] ?? null
    }

    async loadParsers (uids: string[]): Promise<void> {
        // most magic is in recursive query. it returns a flat array of parsers
        // that are either root or dependant to one of given roots or its dependencies
        const flat = await Parser.query('select * from get_parsers_recursive($1, $2)', [uids, Object.keys(this.cacheFunctions)]) as Parser[]

        flat.forEach((it) => {
            this.cacheParsers[it.uid] = it
        })

        uids.forEach((rootUid) => {
            if (this.cacheParsers[rootUid]) {
                this.loadDependencies(this.cacheParsers[rootUid])
            }
        })
    }

    async invalidate (uids: string[]): Promise<void> {
        await redis.publish(ParsersService.REDIS_CHANNEL, JSON.stringify({
            act: 'invalidate',
            uids
        }))
    }

    pullParsers (oldHashes: string[] = []): Promise<Parser[]> {
        let q = {}
        if (oldHashes.length) {
            q = {
                hash: Not(In(oldHashes))
            }
        }

        return Parser.createQueryBuilder('p')
            .addSelect('p.source')
            .where(q)
            .getMany()
            .then((parsers) =>
                Promise.all(parsers.map(async it => {
                    it.source = (await gunzip(it.source) as Buffer).toString('utf-8')

                    return it
                }))
            )
    }

    async pushParsers (edits: AtLeast<Parser, 'uid'>[]): Promise<Parser[]> {
        if (!edits.length) return []

        let edit = createIndex(edits, 'uid')
        let parsers = await Parser.find({
            uid: In(edits.map(i => i.uid))
        })

        // newly added wont be in `parsers`
        let parsersIndex = createIndex(parsers, 'uid')
        let newParsers: AtLeast<Parser, 'uid'>[] = []
        edits.forEach((ed) => {
            if (!parsersIndex[ed.uid]) {
                newParsers.push(ed)
            }
        })

        const allParsers = [...parsers, ...newParsers]

        await Promise.all(allParsers.map(async (p) => {
            if (edit[p.uid]) {
                shallowMerge(p, edit[p.uid])
            }

            p.hash = createHash('md5')
                .update(`${p.uid}\n\n${(p.provide ?? []).sort().join(',')}\n\n${p.code}`)
                .digest()
                .toString('hex')
            p.source = await gzip(p.source ?? '') as string
        }))

        for (let chunk of chunks(allParsers, 1000)) {
            await Parser.createQueryBuilder()
                .insert()
                .values(chunk)
                .onConflict(conflictStatement)
                .execute()
        }

        await this.invalidate(allParsers.map(i => i.uid))

        if (allParsers.some(i => i.cri)) {
            this.startCriProcess()
        }

        return allParsers.map(i => {
            i.source = '<saved>'
            return i
        }) as any
    }

    async deleteParsers (uids: string[]): Promise<void> {
        await Parser.delete({
            uid: In(uids)
        })
        await this.invalidate(uids)
    }

    private __handleMessage (msg: any): void {
        if (msg.act === 'invalidate') {
            msg.uids.forEach((uid: string) => {
                delete this.cacheFunctions[uid]
                delete this.cacheParsers[uid]
            })
        }
    }
}
