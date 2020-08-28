/**
 * Returns whether an object is a POJO
 * (probably created by an object literal)
 *
 * @param obj  Object to check
 */
import { AnyKV } from '@/types/utils'

export function isPojo (obj: any): obj is AnyKV {
    return obj && typeof obj === 'object' && obj.constructor === Object
}

/**
 * Returns whether an object is an array
 *
 * @param obj  Object to check
 */
export function isArray<T = any> (obj: any): obj is Array<T> {
    return obj && typeof obj === 'object' && Array.isArray(obj)
}

/**
 * Creates a deep copy of `target`
 *
 * @param target  Object to be copied
 */
export function clone<T> (target: T): T {
    if (target === null) {
        return target
    }
    if (target instanceof Date) {
        return new Date(target.getTime()) as any
    }
    if (target instanceof Array) {
        const cp = [] as any[];
        (target as any[]).forEach((v) => {
            cp.push(v)
        })
        return cp.map((n: any) => clone<any>(n)) as any
    }
    if (isPojo(target)) {
        const cp = { ...(target as { [key: string]: any }) } as { [key: string]: any }
        Object.keys(cp).forEach(k => {
            cp[k] = clone<any>(cp[k])
        })
        return cp as T
    }
    return target
}

const emptySet = new Set<string>()


/**
 * Merges all `mixins` to `original` object deeply and consequently
 *
 * @param original  Original object
 * @param mixins  List of mixins
 * @param ignore  Properties to ignore while merging mixins
 * @param enableRemove  Whether to enable removal of elements when key in mixin starts with ~ (only for arrays of primitives)
 * @param ignoreUndefined  If true then undefined fields in mixins will be skipped
 * @param uniqueArrays  If true then arrays in resulting object will only contain unique items
 */
export function merge<T, M> (
    original: T,
    mixins: M | M[],
    ignore: Set<string> | string[] = [],
    enableRemove = false,
    ignoreUndefined = false,
    uniqueArrays = false
): T & M {
    if (!Array.isArray(mixins)) mixins = [mixins]
    if (Array.isArray(ignore)) {
        ignore = ignore.length === 0 ? emptySet : new Set(ignore)
    }

    let t = ignore.size > 0

    for (const mixin of mixins) {
        for (let key of Object.keys(mixin)) {
            if (t && ignore.has(key)) continue
            if (ignoreUndefined && mixin[key] === undefined) continue
            let remove = false
            let targetKey = key

            if (key[0] === '~' && enableRemove) {
                remove = true
                targetKey = key.substr(1)
            }

            if (targetKey in original) {
                if (isPojo(original[targetKey]) && isPojo(mixin[key])) {
                    merge(original[targetKey], mixin[key], ignore)
                } else if (isArray(original[targetKey])) {
                    if (isArray(mixin[key])) {
                        if (remove) {
                            original[targetKey] = original[targetKey].filter(it => mixin[key].indexOf(it) === -1)
                        } else {
                            let add = mixin[key]
                            if (uniqueArrays) add = mixin[key].filter(it => original[targetKey].indexOf(it) === -1)
                            original[targetKey].push(...add)
                        }
                    } else {
                        if (remove) {
                            original[targetKey] = original[targetKey].filter(it => mixin[key] !== it)
                        } else {
                            if (uniqueArrays && original[targetKey].indexOf(mixin[key]) === -1) {
                                original[targetKey].push(mixin[key])
                            }
                        }
                    }
                } else {
                    original[targetKey] = mixin[key]
                }
            } else {
                original[targetKey] = mixin[key]
            }
        }
    }

    return original as T & M
}

export function shallowMerge<T, M> (
    original: T,
    mixins: M | M[],
    ignore: Set<string> | string[] = []
): T & M {
    if (!Array.isArray(mixins)) mixins = [mixins]
    if (Array.isArray(ignore)) {
        ignore = ignore.length === 0 ? emptySet : new Set(ignore)
    }

    let t = ignore.size > 0

    for (const mixin of mixins) {
        for (let key of Object.keys(mixin)) {
            if (t && ignore.has(key)) continue

            original[key] = mixin[key]
        }
    }

    return original as T & M
}

/**
 * Similar to python's `enumerate()`.
 * Returns a generator, which for each element from `iterable` generates
 * a pair of `i, item` where `i` is `item`'s index in `iterable`
 *
 * @param iterable  Iterable to enumerate
 */
export function * enumerate<T> (iterable: Iterable<T>): Generator<[number, T]> {
    let i = 0

    for (const x of iterable) {
        yield [i, x]
        i++
    }
}


/**
 * Removes properties `properties` from an object by setting them to undefined
 * Can optionally use `delete` operator to do that (slightly slower)
 *
 * @param obj  Original object
 * @param properties  Properties to be stripped
 * @param useDelete  Whether to use `delete` operator
 */
export function strip<T> (obj: T, properties: (string | number)[], useDelete = false): T {
    if (obj instanceof Array) {
        obj.map(i => strip(i, properties, useDelete))
    } else {
        properties.forEach((prop) => {
            if (prop in obj) {
                if (useDelete) {
                    delete obj[prop]
                } else {
                    obj[prop] = undefined
                }
            }
        })
    }

    return obj
}


/**
 * Returns a new object that only contains properties `properties` of `obj`
 *
 * @param obj  Original object
 * @param properties  Properties to be in new object
 * @param dropUndefined  Whether to skip undefined properties
 */
export function leave<T> (obj: T, properties: (string | number)[], dropUndefined = false): Partial<T> {
    let newObj = {}
    if (obj instanceof Array) {
        obj.map(i => leave(i, properties))

        return obj
    } else {
        properties.forEach((prop) => {
            if (prop in obj) {
                if (obj[prop] === undefined && dropUndefined) return
                newObj[prop] = obj[prop]
            }
        })

        return newObj
    }
}


/**
 * Returns unique items from `array`, inferred from
 * `selector`'s return value (by default unique by itself)
 *
 * @param array
 * @param selector
 */
export function uniqueBy<T> (array: T[], selector: (T) => any = (i: T): T => i): T[] {
    let seen = new Set<T>()
    let out: T[] = []
    let len = array.length
    let j = 0
    for (let i = 0; i < len; i++) {
        let item = array[i]
        let sel = selector(item)
        if (!seen.has(sel)) {
            seen.add(sel)
            out[j++] = item
        }
    }
    return out
}

/**
 * Returns generator of chunks of size `size` from array `arr`
 *
 * @param arr  Original array
 * @param size  Single chunk size
 */
export function * chunks<T> (arr: T[], size): Generator<T[]> {
    for (let i = 0; i < arr.length; i += size) {
        yield arr.slice(i, i + size)
    }
}

/**
 * Returns shallow difference of object `modified` compared to `obj`,
 * in a way that `merge(obj, diff)` deeply equals `modified`
 *
 * @param obj  Object that is used as a base
 * @param modified  Object that is derived from base
 */
export function shallowDiff<T> (obj: T, modified: T): Partial<T> {
    let ret: Partial<T> = {}

    for (let [key, value] of Object.entries(modified)) {
        if (!(key in obj) || obj[key] !== value) {
            ret[key] = value
        }
    }

    return ret
}

/**
 * Deletes all `undefined` values from object.
 *
 * @param obj
 */
export function dropUndefined<T extends AnyKV> (obj: T): T {
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === 'object') dropUndefined(obj[key])
        else if (obj[key] === undefined) delete obj[key]
    })
    return obj
}


export type KeyDelegate<T> = (obj: T) => any

export function createIndex<T extends AnyKV, M extends keyof T> (arr: T[], key: M | KeyDelegate<T>): Record<any, T> {
    let ret: Record<any, T> = {} as any

    if (typeof key === 'string') {
        let k = key
        key = (obj: T): T[M] => obj[k]
    }

    for (let item of arr) {
        ret[(key as KeyDelegate<T>)(item)] = item
    }

    return ret
}

export function createMapIndex<T extends AnyKV, M extends keyof T> (arr: T[], key: M | KeyDelegate<T>): Map<any, T> {
    let ret: Map<any, T> = new Map<any, T>()

    if (typeof key === 'string') {
        let k = key
        key = (obj: T): T[M] => obj[k]
    }

    for (let item of arr) {
        ret.set((key as KeyDelegate<T>)(item), item)
    }

    return ret
}

export function groupBy<T> (ar: T[], grouper: (it: T) => string): Record<string, T[]> {
    let ret: Record<string, T[]> = {}

    ar.forEach((it) => {
        let key = grouper(it)
        if (!ret[key]) {
            ret[key] = []
        }
        ret[key].push(it)
    })

    return ret
}
