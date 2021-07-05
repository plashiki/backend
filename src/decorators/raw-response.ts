import { UseBefore } from 'routing-controllers'
import { Endpoint } from '@/decorators/docs'

export default function RawResponse (): Function {
    return Endpoint({
        features: [
            {
                name: 'raw-response'
            }
        ]
    }, UseBefore((ctx, next) => {
        ctx.raw = true
        return next()
    }))
}
