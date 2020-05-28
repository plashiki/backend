import Application, { Middleware } from 'koa'
import WebsocketController from '@/controllers/WebsocketController'

const websocketMiddleware = (app: Application): Middleware => {
    const controller = new WebsocketController(app)

    return controller.middleware()
}

export default websocketMiddleware
