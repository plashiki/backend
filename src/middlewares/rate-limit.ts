import { Middleware } from 'koa'
import koaRateLimit from 'koa-ratelimit'
import redis from '@/data/redis'

export default function rateLimitMiddleware (requests: number, duration: number, prefix = ''): Middleware {
    return koaRateLimit({
        driver: 'redis',
        db: redis,
        duration: duration * 1000,
        errorMessage: null,
        id: (ctx) => prefix + (ctx.get('CF-Connecting-IP') || ctx.get('X-Real-IP') || ctx.ip),
        max: requests,
        throw: true
    })
}
