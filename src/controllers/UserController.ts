import { Body, Controller, Get, Param, Patch, QueryParam, QueryParams, Session } from 'routing-controllers'
import { UserService } from '@/services/UserService'
import { AssertCurrentUser, CurrentUserAlias, RequireLogin } from '@/decorators/auth-decorators'
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { Expose } from 'class-transformer'
import { IsNumeric } from '@/helpers/validators'
import { AnyKV, ApiError, ApiValidationError, ConnectableService } from '@/types'
import { ISession } from '@/middlewares/01_session'
import { merge, strip } from '@/helpers/object-utils'
import { Endpoint, EntityField } from '@/decorators/docs'
import { User } from '@/models/User'
import { supportedLanguages } from '@/config'
import isURL from 'validator/lib/isURL'

class GetUserParams {
    @Expose()
    @IsString()
    @IsOptional()
    nickname?: string

    @Expose()
    @IsNumeric()
    @IsOptional()
    shikiId?: string

    @Expose()
    @IsOptional()
    withStat?: string
}

class PatchUserBody {
    @EntityField({
        description: 'Toggles user\'s admin status. Only available to admins.'
    })
    @Expose()
    @IsBoolean()
    @IsOptional()
    admin: boolean

    @EntityField({
        description: 'Toggles user\'s moderator status. Only available to admins.'
    })
    @Expose()
    @IsBoolean()
    @IsOptional()
    moderator: boolean

    @EntityField({
        description: 'Toggles user\'s trusted status. Only available to admins and moderators.'
    })
    @Expose()
    @IsBoolean()
    @IsOptional()
    trusted: boolean

    @EntityField({
        description: 'Toggles user\'s banned status. Only available to admins and moderators.'
    })
    @Expose()
    @IsBoolean()
    @IsOptional()
    banned: boolean

    @EntityField({
        description: 'Changes user\'s nickname. Value must be a spare nickname. Available for current user and for admins.'
    })
    @Expose()
    @IsString()
    @IsOptional()
    nickname: string

    @EntityField({
        description: 'Changes user\'s avatar. Value must be a URL to image or null. Available for current user and for admins.'
    })
    @Expose()
    @IsOptional()
    avatar: string | null

    @EntityField({
        description: 'Changes user\'s user rate service. Value must exist in <code>external_ids</code> object. Only available for current user'
    })
    @Expose()
    @IsEnum(ConnectableService)
    @IsOptional()
    service: ConnectableService
}

@Endpoint({
    name: 'Users',
    description: 'User related endpoints'
})
@CurrentUserAlias('id')
@Controller('/v2/users')
export default class UserController {
    service = new UserService()

    @Endpoint({
        name: 'Get user',
        description: 'Get one user by ID',
        query: {
            withStat: {
                type: 'boolean',
                description: 'If present, user will have additional <code>added</code> field, '
                    + 'containing number of added translations by that user'
            }
        },
        params: {
            id: {
                type: 'number',
                description: 'User ID'
            }
        },
        returns: {
            type: 'User | null',
            description: 'Requested user if exists, null otherwise. Note that <code>sub</code> and <code>service</code> '
                + 'fields will only be available for current user'
        }
    })
    @Get('/:id(\\d+|@me)')
    async getUser (
        @Param('id') id: number,
        @QueryParams() params: AnyKV,
        @Session() session: ISession
    ) {
        const user = await this.service.getUserById(id)

        if (!user) return null

        if ('withStat' in params) {
            (user as any).added = await this.service.getUserAddedCount(id)
        }

        if (id === session.userId) {
            return user
        }

        return strip(user, ['sub', 'service'])
    }

    @Endpoint({
        name: 'Patch a user',
        description: 'Change user information.',
        body: {
            type: 'PatchUserBody'
        },
        throws: [
            {
                type: 'ACCESS_DENIED',
                description: 'You can not edit one of fields that were passed in body.'
            },
            {
                type: 'NO_EDIT',
                description: 'Body does not contain any fields'
            },
            {
                type: 'NOT_FOUND',
                description: 'Target user was not found'
            },
            {
                type: 'NOT_CONNECTED',
                description: 'You are trying to change service, but user does not have connected account there.'
            }
        ]
    })
    @RequireLogin()
    @Patch('/:id(\\d+|@me)')
    async patchUser (
        @Param('id') id: number,
        @Session() session: ISession,
        @Body() body: PatchUserBody
    ) {
        const requester = await this.service.getUserById(session.userId!)
        if (!requester) ApiError.e('UNKNOWN_USER')

        let mod: Partial<User> = {}

        if (body.nickname !== undefined) {
            if (id !== session.userId && !requester.admin) {
                ApiError.e('ACCESS_DENIED')
            }
            await this.service.assertNewUser(body.nickname)

            mod.nickname = body.nickname
        }

        if (body.avatar !== undefined) {
            if (typeof body.avatar !== 'string' && body.avatar !== null) {
                ApiValidationError.e('.avatar should be a string or null')
            }
            if (body.avatar && !isURL(body.avatar, {
                protocols: ['http', 'https'],
                require_protocol: true,
                require_host: true,
                require_tld: true,
                require_valid_protocol: true
            })) {
                ApiValidationError.e('.avatar should be a valid url')
            }
            if (id !== session.userId && !requester.admin) {
                ApiError.e('ACCESS_DENIED')
            }

            mod.avatar = body.avatar
        }

        if (body.admin !== undefined || body.moderator !== undefined) {
            if (!requester.admin) {
                ApiError.e('ACCESS_DENIED')
            }
            mod.admin = body.admin
            mod.moderator = body.moderator
        }

        if (body.banned !== undefined || body.trusted !== undefined) {
            if (!requester.admin && !requester.moderator) {
                ApiError.e('ACCESS_DENIED')
            }
            mod.banned = body.banned
            mod.trusted = body.trusted
        }

        const target = await this.service.getUserById(id)
        if (!target) ApiError.e('NOT_FOUND')

        if (body.service !== undefined) {
            if (id !== session.userId) {
                ApiError.e('ACCESS_DENIED')
            }

            if (!(body.service in target?.external_ids)) {
                ApiError.e('NOT_CONNECTED')
            }

            mod.service = body.service
        }

        if (Object.keys(mod).length === 0) {
            ApiError.e('NO_EDIT')
        }

        merge(target, mod, [], false, true)
        await target.save()

        return id === session.userId ? target : target.stripHidden()
    }

    @Endpoint({
        name: 'Control user language',
        description: 'Get or set user language, which will be used in server-side i18n.',
        params: {
            new: {
                type: 'string',
                description: 'Optional. New language to set to user'
            }
        },
        throws: [
            {
                type: 'INVALID_LANG',
                description: 'Given language is unknown. ' +
                    'Currently supported locales can be found in <b>Starting Point</b>'
            }
        ],
        returns: {
            type: 'string',
            description: 'User language'
        }
    })
    @RequireLogin()
    @Get('/:id(\\d+|@me)/lang')
    @AssertCurrentUser('id')
    async controlUserLanguage (
        @QueryParams() params: AnyKV,
        @Session() session: ISession
    ) {
        if (params.new) {
            if (supportedLanguages.indexOf(params.new) === -1) {
                ApiError.e('INVALID_LANG')
            }
            await this.service.setUserLanguage(params.new, session.userId!)
            return params.new
        }

        return this.service.getUserLanguage(session.userId!)
    }


    @Endpoint({
        name: 'Disconnect user service',
        description: 'Removes connection to a given service for a user. '
            + 'User must have at least one active connection though.',
        params: {
            service: {
                type: 'ConnectableService',
                description: 'Service to disconnect'
            }
        },
        throws: [
            {
                type: 'LAST_SERVICE',
                description: 'You are trying to disconnect last connected service, which is not possible'
            },
            {
                type: 'NOT_CONNECTED',
                description: 'You are trying to disconnect a service, which user has no connection to'
            }
        ],
        returns: {
            type: 'User',
            description: 'User'
        }
    })
    @RequireLogin()
    @Get('/:id(\\d+|@me)/disconnect')
    @AssertCurrentUser('id')
    async disconnectService (
        @QueryParam('service') service: ConnectableService,
        @Session() session: ISession
    ) {
        let user = await this.service.getUserById(session.userId!)
        if (!user) ApiError.e('INVALID_SESSION')

        if (!(service in user.external_ids)) ApiError.e('NOT_CONNECTED')
        if (Object.keys(user.external_ids).length === 1) ApiError.e('LAST_SERVICE')

        delete user.external_ids[service]

        try {
            let authData = await this.service.getAuthData(user.id, service)
            if (authData) await authData.remove()
        } catch (e) {
            // probably some enum-related error.
            // even if not, removing auth data is not required, it'll be either re-populated or
            // will become stale, so mostly an optimization
        }

        return user.save()
    }


    @Endpoint({
        name: 'Get user by parameters',
        description: 'Get one user by ID on external service or nickname',
        query: {
            shikiId: {
                type: 'number',
                description: 'User\'s connected Shikimori ID'
            },
            nickname: {
                type: 'string',
                description: 'User\'s nickname'
            },
            withStat: {
                type: 'boolean',
                description: 'If present, user will have additional <code>added</code> field, '
                    + 'containing number of added translations by that user'
            }
        },
        returns: {
            type: 'User | null'
        }
    })
    @Get('/')
    async getUserByParams (
        @QueryParams() params: GetUserParams
    ) {
        let user
        if (params.nickname !== undefined) {
            user = await this.service.getUserByNickname(params.nickname)
        } else if (params.shikiId !== undefined) {
            user = await this.service.getUserByExternalId(ConnectableService.Shikimori, parseInt(params.shikiId))
        } else {
            ApiValidationError.e('invalid query passed.')
        }
        if (!user) return null

        if (params.withStat !== undefined) {
            (user as any).added = await this.service.getUserAddedCount(user.id)
        }

        return strip(user, ['sub', 'service'])
    }
}
