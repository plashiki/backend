import _miniMatch, { IOptions } from 'minimatch'
import { merge } from '@/helpers/object-utils'
import { BinaryLike, createHmac, randomBytes } from 'crypto'
import { commonSecret, session } from '@/config'
import normalizeUrl_ from 'normalize-url'

export const sleep = (s: number): Promise<void> => new Promise(resolve => setTimeout(resolve, s))

export type MMOptions = IOptions & {
    basic?: boolean
}

export function miniMatch (pattern: string, target: string, options?: MMOptions): boolean {
    let opts: IOptions = {}
    if (options?.basic !== false) {
        merge(opts, {
            dot: false,
            noext: true,
            nocase: true,
            nobrace: true,
            nocomment: true,
            nonegate: true
        })
    }

    if (options) {
        merge(opts, options)
    }

    return _miniMatch(target, pattern, opts)
}

export function miniMatchAny (patterns: string[], target: string, options?: MMOptions): boolean {
    return patterns.some((it) => miniMatch(it, target, options))
}

export function createCommonSign (data: BinaryLike, algorithm = 'sha1'): string {
    return createHmac(algorithm, commonSecret).update(data).digest('hex')
}

export function createSignedData (data: Buffer | string | any, salt: BinaryLike, algorithm = 'sha1'): string {
    let type = data instanceof Buffer ? 'R'
        : typeof data === 'string' ? 'S'
            : 'O'
    let b64data = data instanceof Buffer ? data.toString('base64')
        : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64')
    let hash = createHmac(algorithm, commonSecret).update(b64data).update(salt).digest('hex')
    return `${b64data}.${hash}.${type}`
}

export function checkSignedData<T = any> (data: string, salt: BinaryLike, algorithm = 'sha1'): null | T {
    let [b64data, hash, type] = data.split('.')
    if (!hash || !type) return null
    let rhash = createHmac(algorithm, commonSecret).update(b64data).update(salt).digest('hex')
    if (rhash !== hash) return null
    let rdata = Buffer.from(b64data, 'base64')
    if (type === 'S') return rdata.toString() as any
    if (type === 'O') return JSON.parse(rdata.toString())
    if (type === 'R') return rdata as any
    return null
}

export function createNonce (): string {
    // currently without tracking used nonces
    // can't come up with good way of implementing it.
    return createHmac('sha256', commonSecret)
        .update('nonce::')
        .update(Date.now().toString())
        .update(randomBytes(8))
        .digest('base64')
}

export function createTokenSign (raw: string, salt: string): string {
    return createHmac('md4', session)
        .update(salt + raw)
        .digest().subarray(0, 8).toString('base64')
}

export function validateSignedToken (token: string, salt: string): boolean {
    const parts = token.split('.')
    if (parts.length !== 3) {
        return false
    }
    const [nonce, rsalt, hash] = parts
    return createTokenSign(nonce + '.' + rsalt, salt) === hash

}

export function generateSignedToken (salt: string): string {
    const nonce = Buffer.from(Date.now().toString()).toString('base64')
    const rsalt = Buffer.from(randomBytes(8)).toString('base64')
    const raw = nonce + '.' + rsalt
    const hash = createTokenSign(raw, salt)
    return raw + '.' + hash
    // <unixtime>.<random 8 bytes>.<signed hash of prev. data and salt>
    // very unlikely to have collisions
}

export function prepareSqlColumnName (column: string): string {
    return column.split('.')
        .map(j => JSON.stringify(j))
        .join('.')
}

export function generateOnConflictStatement (conflictColumns: string[], updateColumns: string[]): string {
    return '('
        + conflictColumns
            .map(i => prepareSqlColumnName(i))
            .join(',')
        + ') do update set '
        + updateColumns
            .map(i => prepareSqlColumnName(i) + ' = excluded.' + i
                .split('.')
                .pop()
            ).join(', ')
}

/**
 * Im kinda lazy to invent typings here :p
 * Example:
 * [{a: 1, b: 3}, {a: 4, b: 3}] ==> {a: [1, 4], b: [3, 3]}
 *
 * @param {Object<string,*>[]} rows
 * @returns Object<string,*[]>
 */
export function rowsToColumns (rows: any): Record<string, any[]> {
    const ret = {}
    for (let r of rows) {
        for (let k of Object.keys(r)) {
            if (ret[k]) {
                ret[k].push(r[k])
            } else {
                ret[k] = [r[k]]
            }
        }
    }
    return ret
}


export function normalizeUrl (url: string, options?: normalizeUrl_.Options): string {
    // mix in some defaults
    return normalizeUrl_(url, {
        defaultProtocol: 'https',
        forceHttps: true,
        normalizeProtocol: true,
        removeQueryParameters: [
            /^utm_\w+/i,
            'api_hash',
            '__ref',
            ...(options?.removeQueryParameters ?? [])
        ],
        // v better duplicate search
        sortQueryParameters: true,
        ...options
    })
}
