import { UseBefore } from 'routing-controllers'
import { ApiError } from '@/types/errors'
import { User } from '@/models/User'
import { Endpoint } from '@/decorators/docs'
import { miniMatchAny } from '@/helpers/utils'
import { ISession } from '@/middlewares/01_session'

export function RequireCookie (): Function {
    return Endpoint({
        checks: [
            {
                name: 'login',
                params: {
                    via: 'cookie'
                }
            }
        ],
        throws: [
            {
                type: 'NO_OAUTH',
                description: 'Trying to use not OAuth API with OAuth-based auth'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (ctx.session.$type !== 'cookie') {
            ApiError.e('NO_OAUTH', 'This API is not available for OAuth apps.')
        }

        return next()
    }))
}

export function RequireOauth (): Function {
    return Endpoint({
        checks: [
            {
                name: 'login',
                params: {
                    via: 'oauth'
                }
            }
        ],
        throws: [
            {
                type: 'ONLY_OAUTH',
                description: 'Trying to use OAuth API with cookie-based auth'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (ctx.session.$type !== 'oauth') {
            ApiError.e('ONLY_OAUTH', 'This API is only available for OAuth apps.')
        }

        return next()
    }))
}

export function RequireLogin (): Function {
    return Endpoint({
        checks: [
            {
                name: 'login'
            }
        ],
        throws: [
            {
                type: 'NO_AUTH',
                description: 'Not logged in'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (!ctx.session.auth && !ctx.session.$oauth) {
            ApiError.e('NO_AUTH', 'You must be logged in')
        }

        return next()
    }))
}

export function RequireFlag (flag: keyof User, value = true): Function {
    return Endpoint({
        checks: [
            {
                name: 'login'
            },
            {
                name: 'user-flag',
                params: {
                    flag,
                    value
                }
            }
        ],
        throws: [
            {
                type: 'NO_AUTH',
                description: 'Not logged in'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'Flag not set'
            }
        ]
    }, UseBefore(async (ctx, next) => {
        if (!ctx.session.auth && !ctx.session.$oauth) {
            ApiError.e('NO_AUTH', 'You must be logged in')
        }

        const user = await User.findOne({ id: ctx.session.userId! }, {
            select: [flag]
        })
        if (!user) ApiError.e('NOT_FOUND') // weird flex

        if (user[flag] !== value) ApiError.e('ACCESS_DENIED', `You must be ${value ? '' : 'not '}${flag} to use this API`)

        return next()
    }))
}

export function RequireWebsocket (): Function {
    return Endpoint({
        checks: [
            {
                name: 'websocket'
            }
        ],
        throws: [
            {
                type: 'ONLY_WEBSOCKET',
                description: 'Trying to use WebSocket-only api via HTTP'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (!ctx.websocket) {
            ApiError.e('ONLY_WEBSOCKET', 'This API is only available in WebSocket')
        }
        return next()
    }))
}

export function RequireLogout (): Function {
    return Endpoint({
        checks: [
            {
                name: 'logout'
            }
        ],
        throws: [
            {
                type: 'HAS_AUTH',
                description: 'Trying to use API while logged in'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (ctx.session.auth || ctx.session.$oauth) {
            ApiError.e('HAS_AUTH', 'You are already logged in')
        }

        return next()
    }))
}

export function CurrentUserAlias (paramName: string): Function {
    return Endpoint({
        features: [
            {
                name: 'alias',
                params: {
                    at: ':' + paramName,
                    from: '@me',
                    to: '%current user id%'
                }
            }
        ],
        throws: [
            {
                type: 'UNKNOWN_USER',
                description: 'Trying to use @me alias without authorization'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (ctx.params[paramName] === '@me') {
            if ((ctx.session.auth || ctx.session.$oauth) && ctx.session.userId) {
                ctx.params[paramName] = ctx.session.userId
            } else {
                ApiError.e('UNKNOWN_USER', 'You cannot use @me before authorization.')
            }
        }
        return next()
    }))
}

export function AssertCurrentUser (paramName: string): Function {
    return Endpoint({
        checks: [
            {
                name: 'current-user'
            }
        ],
        throws: [
            {
                type: 'ACCESS_DENIED',
                description: 'Trying to access other user\'s API'
            }
        ]
    }, UseBefore((ctx, next) => {
        if (ctx.params[paramName] != ctx.session.userId && ctx.params[paramName] != '@me') {
            ApiError.e('ACCESS_DENIED', 'You have no permission to do this.')
        }
        return next()
    }))
}

export async function requireServerScope (session: ISession, scope: string): Promise<void> {
    if (session.$type !== 'server' || !session.$app || !miniMatchAny(session.$app.server_scope, scope)) {
        ApiError.e('ACCESS_DENIED')
    }
}

export function RequireServerScope (scope: string): Function {
    return Endpoint({
        checks: [
            {
                name: 'server-scope',
                params: {
                    scope
                }
            }
        ],
        throws: [
            {
                type: 'ACCESS_DENIED',
                description: 'You did not pass a valid OAuth client_secret or your app does not have sufficient permissions'
            },
            {
                type: 'INVALID_TOKEN',
                description: 'Given Token does not match any OAuth app.'
            }
        ]
    }, UseBefore(async (ctx, next) => {
        await requireServerScope(ctx.session, scope)
        return next()
    }))
}
