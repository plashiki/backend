import { Context, Next } from 'koa'
import { selfDomainsRegex } from '@/config'

export default async function corsMiddleware (ctx: Context, next: Next): Promise<void> {
    ctx.set('Access-Control-Allow-Origin', ctx.get('Origin'))
    ctx.set('Access-Control-Allow-Credentials', !!ctx.get('Origin').match(selfDomainsRegex) + '')
    ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE')
    if (ctx.method === 'OPTIONS') {
        ctx.body = 'GET,POST,PUT,PATCH,DELETE'
        ctx.set(
            'Access-Control-Allow-Headers',
            ctx.request.get('Access-Control-Request-Headers')
        )
    } else {
        return next()
    }
}
