import { stringify } from 'querystring'
import fetch from 'node-fetch'
import { isProduction, recaptcha } from '@/config'
import { UseBefore } from 'routing-controllers'
import { Context } from 'koa'
import { Endpoint } from '@/decorators/docs'
import { ApiError } from '@/types/errors'

export async function verifyCaptcha (response: string, secret = recaptcha): Promise<boolean> {
    return fetch('https://www.google.com/recaptcha/api/siteverify', {
        body: stringify({
            secret,
            response
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        method: 'POST'
    }).then(i => i.json()).then(i => i.success)
}

export async function verifyCaptchaOrReject (response: string, secret = recaptcha): Promise<void> {
    return verifyCaptcha(response, secret).then((i) => {
        if (!i) ApiError.e('Captcha verification failed')
    })
}

export function CaptchaProtected (timeout: number): Function {
    return Endpoint({
        features: [
            {
                name: 'captcha',
                params: {
                    timeout
                }
            }
        ]
    }, UseBefore((ctx: Context, next) => {
        if (!isProduction) return next()

        const now = Date.now()

        if (ctx.session.$type === 'cookie') {
            if (!ctx.session.captcha || now - ctx.session.captcha > timeout) {
                throw ApiError.CaptchaNeeded
            } else {
                return next()
            }
        } else {
            if (now - ctx.session.$oauth!.captcha > timeout) {
                throw ApiError.CaptchaNeeded
            } else {
                return next()
            }
        }
    }))
}
