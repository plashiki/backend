import { Context, Next } from 'koa'
import { isProduction } from '@/config'
import { ApiError, ApiValidationError } from '@/types'
import { processErrors } from '@/helpers/api-validate'
import { register } from '@/helpers/pretty-stacktrace'

register()

interface KoaEnvelope {
    ok: boolean
    result?: any
    reason?: string
    stack?: string
    serve_time?: number
    description?: string
    warning?: string
}

export default async function envelopeMiddleware (ctx: Context, next: Next): Promise<void> {
    const start = process.hrtime()
    let result
    let error

    try {
        await next()

        if (ctx.body === undefined) {
            error = ApiError.UnknownMethod
        } else {
            result = ctx.body
        }
    } catch (e) {
        if (e?.name === 'BadRequestError') {
            error = new ApiValidationError(processErrors(e?.errors ?? []))
            error.stack = e.stack
        } else if (e?.name === 'NotFoundError') {
            error = ApiError.UnknownMethod
        } else if (e?.name === 'TooManyRequestsError') {
            error = ApiError.TooManyRequests
        } else if (
            e?.name === 'ParamRequiredError'
            || e?.name === 'InvalidParamError'
            || e?.name === 'ParamNormalizationError'
            || e?.name === 'ParameterParseJsonError'
        ) {
            error = new ApiValidationError(e.message)
        } else {
            error = e
        }
    }

    // raw response for html-generating endpoints
    if (ctx.raw) {
        if (error) {
            if (error instanceof ApiError) {
                ctx.status = 400
                ctx.body = `${error.code}: ${error.description ?? ''}`
            } else {
                ctx.body = 'Internal Server Error'
                ctx.status = 500
                console.error(error)
            }
        }
        return
    }

    // just to be sure
    ctx.set('Content-Type', 'application/json')
    ctx.status = 200

    const timeDelta = process.hrtime(start)
    const timeDeltaMs = timeDelta[0] * 1e3 + timeDelta[1] * 1e-6

    const output: KoaEnvelope = {
        ok: error === undefined
    }

    if (error) {
        if (error instanceof ApiError) {
            output.reason = error.code
            output.description = error.description
        } else if (error instanceof SyntaxError) {
            output.reason = 'Invalid syntax'
        } else {
            output.reason = 'Internal Error'
            output.description = error.constructor.name
        }

        if (!isProduction) {
            output.stack = error.stack
        }

        if (!(error instanceof ApiError)) {
            console.error(error)
        }
    } else {
        output.result = result
    }

    if (ctx.deprecated) {
        output.warning = 'This method is deprecated. ' + ctx.deprecated
    }

    output.serve_time = timeDeltaMs

    ctx.body = output
}
