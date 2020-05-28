import 'reflect-metadata'
import bodyParser from 'koa-bodyparser'
import * as path from 'path'
import { useKoaServer } from 'routing-controllers'
import { port } from '@/config'
import { AnyKV } from '@/types'
import directoryLoader, { LoadedDefaultModule } from '@/helpers/directory-loader'

import envelopeMiddleware from '@/middlewares/00_envelope'
import sessionMiddleware from '@/middlewares/01_session'
import corsMiddleware from '@/middlewares/02_cors'
import websocketMiddleware from '@/middlewares/03_websocket'

import { defaultValidatorOptions } from '@/helpers/api-validate'

import fixValidation from '@/helpers/fix-validation'
import { DEBUG } from '@/helpers/debug'
import Koa = require('koa')

fixValidation()

export default async function koaLoader (noStart = false): Promise<void> {
    const app = new Koa()

    app.use(envelopeMiddleware)
    app.use(bodyParser({
        strict: true
    }))

    app.use(sessionMiddleware)
    app.use(corsMiddleware)
    const controllers = await directoryLoader<LoadedDefaultModule<AnyKV, Function>, Function>(
        path.join(__dirname, '../controllers'), mod => mod.default
    )()

    useKoaServer(app, {
        controllers,
        routePrefix: '/api',
        defaultErrorHandler: false,  // we have envelope, thanks
        validation: defaultValidatorOptions,
        plainToClassTransformOptions: {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }
    })

    app.use(websocketMiddleware(app))

    app.onerror = (err: any): void => {
        // vzlom beb 3
        if (!err?.code?.match?.(/^(EPIPE|ECONNRESET)$/)) {
            console.log(err)
        }
    }

    if (!noStart) {
        app.listen(port, () => DEBUG.boot(`Listening on ${port}`))
    }
}
