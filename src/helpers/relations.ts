import fetch from 'node-fetch'
import * as fs from 'fs'
import { join } from 'path'
import { DEBUG } from './debug'
import { merge } from '@/helpers/object-utils'

type RelationIdSource = 'mal' | 'kitsu' | 'anilist'
type RelationIdInfo = Record<RelationIdSource, string | null>

interface RelationEpisode {
    id: RelationIdInfo
    n: number
}

type RelationDataAnime = Record<number, RelationEpisode> & {
    '?'?: {
        // a|b|c:$start-? -> $id:$target-?
        type: 'range'

        start: number
        target: number
        id: RelationIdInfo
    } | {
        // a|b|c:$start-? -> $id:$target
        type: 'single'

        start: number
        target: number
        id: RelationIdInfo
    }
}
type RelationData = Record<string, RelationDataAnime>

const RELATIONS_DEFAULT_FILE = 'https://raw.githubusercontent.com/erengy/anime-relations/master/anime-relations.txt'

export class RelationsParser {
    private static __instance?: RelationsParser
    data: RelationData = {}

    private constructor () {
        // noop //
    }

    static get instance (): RelationsParser {
        if (!RelationsParser.__instance) {
            RelationsParser.__instance = new RelationsParser()
        }
        return RelationsParser.__instance!
    }

    private static _parseLine (toIds: RelationIdInfo, fromEpisodes: string, toEpisodes: string): RelationDataAnime {
        let obj: RelationDataAnime = {}
        let fromRange = fromEpisodes.indexOf('-') > -1
        let toRange = toEpisodes.indexOf('-') > -1

        // anchors for ranges
        // (im not rly good at naming tho)
        let fromEpisodesFrom: string | null = null
        let fromEpisodesTo: string | null = null
        let toEpisodesFrom: string | null = null
        let toEpisodesTo: string | null = null
        if (fromRange) {
            ([fromEpisodesFrom, fromEpisodesTo] = fromEpisodes.split('-'))
        }
        if (toRange) {
            ([toEpisodesFrom, toEpisodesTo] = toEpisodes.split('-'))
        }

        if (fromRange) {
            if (fromEpisodesTo === '?') {
                if (toRange) {
                    if (toEpisodesTo !== '?') {
                        DEBUG.relations('Unexpected variable mapping: N-? -> M-%d', toEpisodesTo)
                    }

                    obj['?'] = {
                        type: 'range',
                        start: parseInt(fromEpisodesFrom!),
                        target: parseInt(toEpisodesFrom!),
                        id: toIds
                    }
                } else {
                    obj['?'] = {
                        type: 'single',
                        start: parseInt(fromEpisodesFrom!),
                        target: parseInt(toEpisodes),
                        id: toIds
                    }
                }
            } else {
                let from = parseInt(fromEpisodesFrom!)
                let to = parseInt(fromEpisodesTo!)
                let diff = to - from
                if (diff < 0) {
                    DEBUG.relations('Unexpected negative difference: %d-%d', from, to)
                }
                let toStart = toRange ? parseInt(toEpisodesFrom!) : parseInt(toEpisodes)
                for (let i = 0; i <= diff; i++) {
                    obj[from + i] = {
                        id: toIds,
                        n: toRange ? toStart + i : toStart
                    }
                }
            }
        } else {
            if (toRange) {
                DEBUG.relations('Unexpected mapping single to range: %s -> %s', fromEpisodes, toEpisodes)
            }
            obj[fromEpisodes] = {
                id: toIds,
                n: parseInt(toEpisodes)
            }
        }

        return obj
    }

    private static _parseIds (ids: string, previous?: RelationIdInfo): RelationIdInfo {
        let [mal, kitsu, anilist] = ids.split('|') as (string | null)[]
        if (previous) {
            if (mal === '~') mal = previous.mal
            if (kitsu === '~') kitsu = previous.kitsu
            if (anilist === '~') anilist = previous.anilist
        }
        if (mal === '?') mal = null
        if (kitsu === '?') kitsu = null
        if (anilist === '?') anilist = null
        return {
            mal,
            kitsu,
            anilist
        }
    }

    async load (filename = RELATIONS_DEFAULT_FILE): Promise<void> {
        if (filename.match(/^https?:\/\//)) {
            const data = await fetch(filename).then(i => i.text())
            return this.loadRaw(data)
        } else {
            const data = await fs.promises.readFile(filename)
            return this.loadRaw(data.toString('utf-8'))
        }
    }

    loadRaw (text: string): void {
        const lines = text.split('\n')
        let rulesGroup = false
        for (let line of lines) {
            if (!line.length || line[0] === '#') continue
            if (line[0] === line[1] && line [1] === ':') {
                rulesGroup = line.substr(2) === 'rules'
                continue
            }
            if (line[0] !== '-' || !rulesGroup) continue
            let [[fromIds_, fromEpisodes], [toIds_, toEpisodes]] =
                line.substr(1).trim().split('->').map(i => i.trim().split(':'))
            const fromIds = RelationsParser._parseIds(fromIds_)
            const toIds = RelationsParser._parseIds(toIds_, fromIds)
            let selfReference = false
            if (toEpisodes[toEpisodes.length - 1] === '!') {
                toEpisodes = toEpisodes.substr(0, toEpisodes.length - 1)
                selfReference = true
            }

            let obj = RelationsParser._parseLine(toIds, fromEpisodes, toEpisodes)
            this._addRelationDataAnime(fromIds, obj)
            if (selfReference) {
                this._addRelationDataAnime(toIds, obj)
            }
        }
    }

    findRelation (animeId: number, source: RelationIdSource, episode: number): RelationEpisode | null {
        let key = source[0] + animeId
        if (!(key in this.data)) return null

        let d = this.data[key] as RelationDataAnime
        if (!(episode in d)) {
            if (d['?'] !== undefined && episode >= d['?'].start) {
                if (d['?'].type === 'range') {
                    return {
                        n: episode - d['?'].start + d['?'].target,
                        id: d['?'].id
                    }
                } else {
                    return {
                        n: d['?'].target,
                        id: d['?'].id
                    }
                }
            }
            return null
        }

        return d[episode]
    }

    async saveToFile (filename: string): Promise<void> {
        await fs.promises.writeFile(join(__dirname, '../../', filename), JSON.stringify(this.data, null, 4))
    }

    loadFromFile (filename: string): void {
        this.data = require(join(__dirname, '../../', filename))
    }

    private _addRelationDataAnime (ids: RelationIdInfo, obj: RelationDataAnime): void {
        let set = (k: string): void => {
            if (k in this.data) {
                merge<RelationDataAnime, RelationDataAnime>(this.data[k], obj)
            } else {
                this.data[k] = obj
            }
        }

        if (ids.mal !== null) set('m' + ids.mal)
        if (ids.kitsu !== null) set('k' + ids.kitsu)
        if (ids.anilist !== null) set('a' + ids.anilist)
    }
}
