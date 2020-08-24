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
import { createServer } from 'http'
import { Socket } from 'net'
import Koa = require('koa')
import { chmodSync, unlinkSync } from 'fs'
import { LOG } from '@/helpers/logging'

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
        const server = createServer(app.callback())

        const onListening = (): void => {
            if (isNaN(parseInt(port))) {
                chmodSync(port, 0o777)
            }
            LOG.boot.info('Listening on %s', port)
        }

        // taken from https://stackoverflow.com/a/16502680
        server.on('error', (e: any) => {
            if (e.code == 'EADDRINUSE') {
                if (!isNaN(parseInt(port))) {
                    console.error(e)
                    process.exit(1)
                }

                let clientSocket = new Socket()
                clientSocket.on('error', (e: any) => { // handle error trying to talk to server
                    if (e.code == 'ECONNREFUSED') {  // No other server listening
                        unlinkSync(port)
                        server.listen(port, onListening)
                    }
                })

                clientSocket.connect({ path: port }, function () {
                    LOG.boot.error('Server running, giving up...')
                    process.exit()
                })
            }
        })

        server.listen(port, onListening)
    }
}
