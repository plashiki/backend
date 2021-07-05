import * as cheerio from 'cheerio'
import * as objectUtils from '../helpers/object-utils'
import FormData from 'form-data'
import * as iconv from 'iconv-lite'
import * as vm from 'vm'
import { KeyValue } from '@/models/KeyValue'
import WebSocket from 'ws'
import * as qs from 'querystring'
import * as crypto from 'crypto'
import { JSDOM } from 'jsdom'
import PB from 'protoflex'
import * as anitomy from '@teidesu/anitomy-js'
import * as fuzz from 'fuzzball'
import acorn from 'acorn'
import * as JSON5 from 'json5'
import { normalizeUrl } from '@/helpers/utils'
import fetchRetry from '@/helpers/fetch-retry'
import { RelationsParser } from '@/helpers/relations'
import Mapping from '@/models/Mapping'
import { AbortController, AbortSignal } from 'abort-controller'
import puppeteer from 'puppeteer'
import MediaPart from '@/models/MediaPart'
import { asyncPool } from '@/helpers/async-pool'

export type DynamicOptions<T, I> = {
    [key in keyof T]?: T[key] | ((item: I) => Promise<T[key]> | T[key])
}

export const libs = {
    cheerio,
    acorn,
    JSON5,
    fetch: fetchRetry,
    objectUtils,
    vm,
    fuzz,
    FormData,
    iconv,
    // when running locally there's a file-based stub,
    // so dont use typeorm api as it wont be available
    kv: KeyValue,
    WebSocket,
    qs,
    crypto,
    JSDOM,
    puppeteer,
    PB,
    anitomy,
    relations: RelationsParser.instance,
    mappings: Mapping,
    mediaParts: MediaPart,
    AbortController,
    AbortSignal,
    asyncPool,

    // util functions
    sleep: (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms)),
    normalizeUrl,
    async resolveDynamicOptions<T, I> (options: DynamicOptions<T, I>, item: I): Promise<Partial<T>> {
        let ret: Partial<T> = {}
        for (let key of Object.keys(options)) {
            let value = options[key]
            if (value instanceof Function) {
                ret[key] = await value(item)
            } else {
                ret[key] = value
            }
        }

        return ret
    }
}
