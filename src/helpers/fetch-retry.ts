import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch'
import { sleep } from '@/helpers/utils'
import { ApiError } from '@/types/errors'

export type RetryRequestInit = RequestInit & {
    attempts?: number
    sleep?: number
    validator?: (response: Response) => boolean | string | Promise<boolean | string>
}

export default async function fetchRetry (url: RequestInfo, options?: RetryRequestInit): Promise<Response> {
    let i = 0
    const max = options?.attempts ?? 3
    while (i < max) {
        try {
            const response = await fetch(url, options)
            if (options?.validator) {
                let res = await options.validator(response)
                if (res !== true) {
                    ApiError.e(res === false ? 'FETCH_ERROR' : res)
                }
            }
            return response
        } catch (e) {
            if (++i >= max) {
                throw e
            }
        }
        if (options?.sleep) {
            await sleep(options.sleep)
        }
    }
    throw Error('Should not get here')
}
