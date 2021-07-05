import { UseAfter } from 'routing-controllers'
import { Endpoint } from '@/decorators/docs'

export default function Deprecated (reason?: string): Function {
    return Endpoint({
        deprecated: true
    }, UseAfter((ctx) => ctx.deprecated = reason))
}
