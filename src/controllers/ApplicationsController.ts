import { Body, Controller, Delete, Get, Param, Patch, Post, QueryParams, Session } from 'routing-controllers'
import { RequireCookie, RequireFlag, RequireLogin } from '@/decorators/auth-decorators'
import { Endpoint } from '@/decorators/docs'
import { ISession } from '@/middlewares/01_session'
import { ApplicationsService } from '@/services/ApplicationsService'
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { Expose } from 'class-transformer'
import RateLimit from '@/decorators/rate-limit'
import { User } from '@/models/User'
import { merge, strip } from '@/helpers/object-utils'
import { Paginated } from '@/types/api'
import { ApiError } from '@/types/errors'

class CreateApplicationBody {
    @Expose()
    @IsString()
    name: string

    @Expose()
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    description?: string

    @Expose()
    @IsUrl()
    @IsOptional()
    icon?: string

    @Expose()
    @IsUrl()
    @IsOptional()
    redirect_uri?: string
}

class PatchApplicationBody {
    @Expose()
    @IsString()
    @IsOptional()
    name: string

    @Expose()
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    description?: string

    @Expose()
    @IsUrl()
    @IsOptional()
    icon?: string

    @Expose()
    @IsUrl()
    @IsOptional()
    redirect_uri?: string

    @Expose()
    @IsString({ each: true })
    @IsOptional()
    server_scope?: string[]
}

@Endpoint({
    name: 'OAuth applications',
    description: 'Control your OAuth applications. ' +
        'Before using please read about PlaShiki OAuth flow in <b>Starting Point</b> section'
})
@RequireLogin()
@RequireCookie()
@Controller('/v2/applications')
export default class ApplicationsController {
    service = new ApplicationsService()

    @Endpoint({
        name: 'Get user\'s OAuth applications',
        description: 'Returns a list of current user\'s OAuth applications',
        query: {
            $extends: 'Paginated'
        },
        returns: {
            type: 'OAuthApp[]',
            description: 'Meta information about apps. Client ID & secret are not available.'
        }
    })
    @Get('/')
    async getUserApplications (
        @QueryParams() params: Paginated,
        @Session() session: ISession
    ) {
        return this.service.getApplications(params, session.userId!)
    }

    @Endpoint({
        name: 'Get all OAuth applications',
        description: 'Returns a list of all OAuth applications. Only for admins.',
        query: {
            $extends: 'Paginated'
        },
        returns: {
            type: 'OAuthApp[]',
            description: 'Meta information about apps. <code>client_id</code> and <code>client_secret</code> are not available.'
        }
    })
    @RequireFlag('admin')
    @Get('/all')
    async getAllApplications (
        @QueryParams() params: Paginated
    ) {
        return this.service.getApplications(params)
    }

    @Endpoint({
        name: 'Create OAuth application',
        description: 'Creates an OAuth application.',
        returns: {
            type: 'OAuthApp',
            description: 'Newly created OAuth app. <code>client_id</code> and <code>client_secret</code> are available.'
        }
    })
    @RateLimit(1, 600, 'create-app/')
    @RequireFlag('banned', false)
    @Post('/')
    async createApplication (
        @Body() body: CreateApplicationBody,
        @Session() session: ISession
    ) {
        return this.service.createApplication(body, session.userId!)
    }

    @Endpoint({
        name: 'Get OAuth application',
        description: 'Get a single OAuth applications. Non-admins can only get own applications.',
        params: {
            id: {
                type: 'number',
                description: 'Application ID'
            }
        },
        throws: [
            {
                type: 'ACCESS_DENIED',
                description: 'Attempt to get information for another user\'s application.'
            }
        ],
        returns: {
            type: 'OAuthApp | null',
            description: '<code>client_id</code> and <code>client_secret</code> are only available for own apps, even for admins.'
        }
    })
    @Get('/:id(\\d+)')
    async getApplication (
        @Param('id') appId: number,
        @Session() session: ISession
    ) {
        const app = await this.service.getApplication(appId, true)
        if (!app) return null

        if (app.owner_id !== session.userId) {
            // admin or die
            if (await User.hasFlag(session.userId!, 'admin')) {
                return strip(app, ['client_id', 'client_secret'])
            }
            ApiError.e('ACCESS_DENIED')
        }

        return app
    }

    @Endpoint({
        name: 'Revoke application credentials',
        description: 'Revoke application\'s <code>client_id</code> or <code>client_secret</code>. ' +
            'Current user must be app owner.',
        params: {
            id: {
                type: 'number',
                description: 'Application ID'
            },
            field: {
                type: '"id" | "secret" | "both"',
                description: 'Which field to revoke. <code>id</code> is for <code>client_id</code>, ' +
                    '<code>secret</code> is for <code>client_secret.</code> and ' +
                    '<code>both</code> is to revoke both at once.'
            }
        },
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Application was not found'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'Attempt to modify another user\'s application.'
            }
        ],
        returns: {
            type: 'OauthApp',
            description: 'Same application but with different credentials (which are always available)'
        }
    })
    @Get('/:id(\\d+)/revoke/:field(id|secret|both)')
    async revokeCredentials (
        @Param('id') appId: number,
        @Param('field') field: 'id' | 'secret' | 'both',
        @Session() session: ISession
    ) {
        const app = await this.service.getApplication(appId, true)
        if (!app) {
            ApiError.e('NOT_FOUND')
        }

        if (app.owner_id !== session.userId) {
            ApiError.e('ACCESS_DENIED')
        }

        return this.service.revoke(app, field)
    }

    @Endpoint({
        name: 'Get authorized applications',
        description: 'Returns list of applications that current user had given access to.',
        returns: {
            type: 'OauthApp[]',
            description: 'Only meta information about apps'
        }
    })
    @Get('/authed')
    async getAuthedApplications (
        @Session() session: ISession
    ) {
        return this.service.getAuthedApplications(session.userId!)
    }

    @Endpoint({
        name: 'Revoke authorization',
        description: 'Revoke application access to user account. ' +
            'Meaning that it will destroy all active current user\'s OAuth sessions for that application',
        params: {
            id: {
                type: 'number',
                description: 'Application ID for which to revoke access.'
            }
        },
        returns: {
            type: 'true'
        }
    })
    @Get('/:id(\\d+)/revoke/auth')
    async revokeAuthorization (
        @Param('id') appId: number,
        @Session() session: ISession
    ) {
        return this.service.revokeAuthorization(appId, session.userId!)
    }

    @Endpoint({
        name: 'Delete application',
        description: 'Deleting an application will automatically revoke all active sessions. ' +
            'Can only be done by app owner or admin',
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Application was not found'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'Attempt to delete other user\'s application'
            }
        ],
        params: {
            id: {
                type: 'number',
                description: 'Application ID to delete.'
            }
        },
        returns: {
            type: 'true'
        }
    })
    @Delete('/:id(\\d+)')
    async deleteApplication (
        @Param('id') appId: number,
        @Session() session: ISession
    ) {
        const app = await this.service.getApplication(appId)
        if (!app) ApiError.e('NOT_FOUND')

        if (app.owner_id !== session.userId) {
            // admin or die
            if (!(await User.hasFlag(session.userId!, 'admin'))) {
                ApiError.e('ACCESS_DENIED')
            }
        }

        await this.service.revokeAllActiveSessions(app.id)
        await app.remove()
        return true
    }

    @Endpoint({
        name: 'Edit application',
        description: 'Update application fields. You can edit icon, name, description and redirect_uri. ' +
            'Also admins can edit server_scope.',
        throws: [
            {
                type: 'NOT_FOUND',
                description: 'Application was not found'
            },
            {
                type: 'ACCESS_DENIED',
                description: 'Attempt to modify other user\'s application'
            }
        ],
        params: {
            id: {
                type: 'number',
                description: 'Application ID to edit.'
            }
        },
        returns: {
            type: 'OauthApp'
        }
    })
    @Patch('/:id(\\d+)')
    async patchApplication (
        @Param('id') appId: number,
        @Body() body: PatchApplicationBody,
        @Session() session: ISession
    ) {
        const app = await this.service.getApplication(appId, true)
        if (!app) ApiError.e('NOT_FOUND')

        let isAdmin = await User.hasFlag(session.userId!, 'admin')

        if (!isAdmin && (session.userId !== app.owner_id || body.server_scope)) {
            ApiError.e('ACCESS_DENIED')
        }

        merge(app, body, ['server_scope'], false, true)
        if (body.server_scope) {
            app.server_scope = body.server_scope
        }

        await app.save()

        return app
    }
}
