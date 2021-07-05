import { UseBefore } from 'routing-controllers'
import rateLimitMiddleware from '@/middlewares/rate-limit'
import { isProduction } from '@/config'
import { Endpoint } from '@/decorators/docs'

export default function RateLimit (requests: number, duration: number, prefix = ''): Function {
    return Endpoint({
            features: [
                {
                    name: 'rate-limit',
                    params: {
                        requests,
                        duration
                    }
                }
            ]
        },
        isProduction
            ? UseBefore(rateLimitMiddleware(requests, duration, prefix))
            : (): void => {
                /* no-op */
            }
    )
}
