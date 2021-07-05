// not exactly middleware, but is a shorthand for koa stuff, so placed here
import { Context } from 'koa'

export default function redirect (ctx: Context, target: string): string {
    ctx.set('Location', target)
    ctx.status = 302
    ctx.raw = true
    return `You are being redirected to <a href="${target}">${target}</a>`
}
