import { AnyKV } from '@/types'
import { isProduction, telegram } from '@/config'
import fetchRetry from '@/helpers/fetch-retry'
import FormData from 'form-data'
import { isPojo } from '@/helpers/object-utils'
import { DEBUG } from '@/helpers/debug'

const API_PREFIX = 'https://api.telegram.org/bot' + telegram.token + '/'
let httpAgent = undefined
if (telegram.proxy && telegram.proxy !== 'null') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    httpAgent = new (require('simple-proxy-agent'))(telegram.proxy)
}

export class TelegramApiError extends Error {
}

export function telegramApi<T = any> (method: string, params: AnyKV): Promise<T> {
    return fetchRetry(API_PREFIX + method, {
        method: 'POST',
        body: JSON.stringify(params),
        headers: {
            'Content-Type': 'application/json'
        },
        agent: httpAgent
    }).then(i => i.json()).then(i => {
        if (i.ok) {
            return i.response
        }

        throw new TelegramApiError(i.description)
    })
}

export function telegramApiMultipart<T> (method: string, data: AnyKV): Promise<T> {
    let body = new FormData()
    for (const [key, value] of Object.entries(data)) {
        if (value.$file) {
            body.append(key, value, {
                filename: value.filename ?? 'file.bin',
                contentType: value.contentType ?? 'application/octet-stream'
            })
        } else {
            body.append(key, isPojo(value) ? JSON.stringify(value) : value)
        }
    }

    return fetchRetry(API_PREFIX + method, {
        method: 'POST',
        body: body.getBuffer(),
        headers: body.getHeaders(),
        agent: httpAgent
    }).then(i => i.json()).then(i => {
        if (i.ok) {
            return i.response
        }

        throw new TelegramApiError(i.description)
    })
}

export function sendTelegramMessage (chatId: number | string, text: string): Promise<any> { // idk i dont want to make types for tg api
    return telegramApi('sendMessage', {
        chat_id: chatId,
        text: text.replace(/<br\s*\/?>/g, '\n'),
        parse_mode: 'html'
    })
}

export function sendTelegramMessageToMainChannel (text: string): Promise<any> {
    if (!isProduction) {
        DEBUG.telegram('Sending message: %s', text)
    }
    return sendTelegramMessage(telegram.channel, text)
}
