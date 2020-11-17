import { Controller, Get, QueryParam, Session } from 'routing-controllers'
import { RequireLogin } from '@/decorators/auth-decorators'
import { ISession } from '@/middlewares/01_session'
import { UserService } from '@/services/UserService'
import { uniqueBy } from '@/helpers/object-utils'
import { PushService } from '@/services/PushService'
import { Endpoint } from '@/decorators/docs'
import { ApiError, ApiValidationError } from '@/types/errors'

@Endpoint({
    name: 'Notifications',
    description: 'Notification-related endpoints'
})
@Controller('/v2/notifications')
export default class NotificationController {
    userService = new UserService()
    pushService = PushService.instance

    @Endpoint({
        name: 'Subscribe',
        description: 'Subscribes current user to a list of given topics',
        query: {
            topics: {
                type: 'string[]',
                required: true,
                description: 'Comma-delimited list of topics to subscribe to. Topics are case-insensitive.'
            }
        },
        returns: {
            type: 'string[]',
            description: 'List of topics that user is currently subscribed to'
        }
    })
    @RequireLogin()
    @Get('/subscribe')
    async subscribe (
        @QueryParam('topics') topicsString: string,
        @Session() session: ISession
    ) {
        const opts = await this.userService.getUserByIdOrThrow(session.userId!)

        let topics = topicsString.toLowerCase().split(',')
        topics.forEach(it => {
            if (!it.match(/^[a-z0-9]+(:[a-z0-9]+)*$/)) {
                ApiValidationError.e('invalid topic: ' + it)
            }
        })

        opts.sub = uniqueBy([...(opts.sub ?? []), ...topics])

        await opts.save()

        return opts.sub
    }

    @Endpoint({
        name: 'Unsubscribe',
        description: 'Unsubscribes current user from a list of given topics',
        query: {
            topics: {
                type: 'string[]',
                required: true,
                description: 'Comma-delimited list of topics to unsubscribe form. Topics are case-insensitive.'
            }
        },
        returns: {
            type: 'string[]',
            description: 'List of topics that user is currently subscribed to'
        }
    })
    @RequireLogin()
    @Get('/unsubscribe')
    async unsubscribe (
        @QueryParam('topics') topicsString: string,
        @Session() session: ISession
    ) {
        const opts = await this.userService.getUserByIdOrThrow(session.userId!)

        let topics = topicsString.toLowerCase().split(',')
        topics.forEach(it => {
            if (!it.match(/^[a-z0-9]+(:[a-z0-9]+)*$/)) {
                ApiValidationError.e('invalid topic: ' + it)
            }
        })

        opts.sub = opts.sub?.filter(it => topics.indexOf(it) === -1) ?? []

        await opts.save()

        return opts.sub
    }

    @Endpoint({
        name: 'Get topics',
        description: 'Get current user\'s subscriptions',
        returns: {
            type: 'string[]',
            description: 'List of topics that user is currently subscribed to'
        }
    })
    @RequireLogin()
    @Get('/mytopics')
    async getUserTopics (
        @Session() session: ISession
    ) {
        return this.userService.getUserByIdOrThrow(session.userId!).then(i => i.sub ?? [])
    }

    @Endpoint({
        name: 'Missed notifications',
        description: 'Get missed notifications. Note that notifications are stored server-side for 60 days',
        query: {
            since: {
                type: 'number',
                required: true,
                description: 'Unix timestamp of last synchronization'
            }
        },
        returns: {
            type: 'Notification[]',
            description: 'List of topics that user is currently subscribed to'
        }
    })
    @RequireLogin()
    @Get('/missed')
    async getMissedNotifications (
        @QueryParam('since') since: number,
        @Session() session: ISession
    ) {
        if (isNaN(since)) {
            ApiValidationError.e('since must be a number')
        }

        let now = Date.now()
        let delta = now - since

        if (delta < 0) return []
        if (delta > 5184000000) since = now - 5184000000 // 60 days

        return PushService.instance.getMissedNotifications(
            new Date(since),
            await this.getUserTopics(session),
            session.userId!
        )
    }

    @Endpoint({
        name: 'Add Firebase token',
        description: 'Adds a Firebase token to current user, which will be used to notify user while he is offline.',
        query: {
            token: {
                type: 'string',
                required: true,
                description: 'Firebase token'
            }
        },
        returns: {
            type: '"OK"'
        },
        throws: [
            {
                type: 'INVALID_FIREBASE_TOKEN',
                description: 'Given Firebase token is invalid'
            }
        ]
    })
    @RequireLogin()
    @Get('/addFirebaseToken')
    async addFirebaseToken (
        @QueryParam('token') firebaseToken: string,
        @Session() session: ISession
    ) {
        const valid = await this.pushService.checkFirebaseToken(firebaseToken)

        if (!valid) {
            ApiError.e('INVALID_FIREBASE_TOKEN')
        }

        await this.pushService.addFirebaseToken(firebaseToken, session.userId!)

        return 'OK'
    }

    @Endpoint({
        name: 'Remove Firebase token',
        description: 'Removes a Firebase token from database. Does not require auth.',
        query: {
            token: {
                type: 'string',
                required: true,
                description: 'Firebase token'
            }
        },
        returns: {
            type: '"OK"'
        }
    })
    @Get('/removeFirebaseToken')
    async removeFirebaseToken (
        @QueryParam('token') firebaseToken: string
    ) {
        await this.pushService.removeFirebaseToken(firebaseToken)

        return 'OK'
    }

    @Endpoint({
        name: 'Mark notifications as seen',
        description: 'Mark notifications with given IDs as seen. When implementing on client-side, since users usually '
            + 'read many notifications at once, it is best to debounce the events and call this method with multiple IDs',
        query: {
            ids: {
                type: 'number[]',
                required: true,
                description: 'IDs of notifications to mark as read, delimited with a comma.'
            }
        },
        returns: {
            type: '"OK"'
        }
    })
    @RequireLogin()
    @Get('/markAsSeen')
    async markAsSeen (
        @QueryParam('ids', { required: true }) idsString: string,
        @Session() session: ISession
    ) {
        let ids = idsString.split(',').map(i => parseInt(i))
        if (!ids.length) ApiError.e('VALIDATION_ERROR', '.ids: there must be at least one item')
        if (ids.some(isNaN)) ApiError.e('VALIDATION_ERROR', '.ids: all items must be numbers')

        await this.pushService.markNotificationsAsSeen(ids, session.userId!)

        return 'OK'
    }
}
