import { AnyKV } from '@/types'
import fetchRetry from '@/helpers/fetch-retry'
import { stringify } from 'querystring'
import { vk } from '@/config'

export class VkApiError extends Error {
}

export function vkApi<T = any> (method: string, params: AnyKV): Promise<T> {
    return fetchRetry(`https://api.vk.com/method/${method}`, {
        method: 'POST',
        body: stringify({
            v: 5.92,
            access_token: vk,
            ...params
        })
    }).then(i => i.json()).then(json => {
        if (json.error) throw new VkApiError(json.error.error_msg)
        return json.response
    })
}

