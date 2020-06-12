import { Controller, Ctx, Get, Param, QueryParam, QueryParams, Session } from 'routing-controllers'
import { TranslationService } from '@/services/TranslationService'
import { ApiError, ApiValidationError, MediaType } from '@/types'
import { GetTranslationsParameters } from '@/services/TranslationService.types'
import { IsOptional, IsString, ValidateIf } from 'class-validator'
import Deprecated from '../decorators/deprecated'
import { TranslationStatus } from '@/models/Translation'
import { ISession } from '@/middlewares/01_session'
import { UserService } from '@/services/UserService'
import { Expose } from 'class-transformer'
import { Context } from 'koa'
import { In } from 'typeorm'
import { Endpoint } from '@/decorators/docs'
import { IsNumeric } from '@/helpers/validators'


class GetTranslationsParametersCompat extends GetTranslationsParameters {
    @Expose()
    @IsOptional()
    formatted?: boolean

    @Expose()
    @IsString()
    @IsOptional()
    anime?: string

    @Expose()
    @IsNumeric()
    @IsOptional()
    episode?: string

    @Expose()
    @IsString()
    @ValidateIf(c => !('anime' in c))
    target?: string
}

@Endpoint({
    name: 'Translations',
    description: 'Fetch information about currently available translations'
})
@Controller()
export default class TranslationController {
    service = new TranslationService()
    userService = new UserService()


    @Endpoint({
        name: 'Get media translations',
        description: 'Get media translations by media ID, type and optionally part number.',
        params: {
            type: {
                type: '"anime" | "manga"',
                description: 'Media type'
            },
            id: {
                type: 'number',
                description: 'Media ID (MAL)'
            },
            part: {
                type: 'number',
                description: 'Part number'
            }
        },
        query: {
            $extends: 'GetTranslationsParameters'
        },
        returns: {
            type: 'Translation[] | TranslationQueryResult',
            description: 'List of matching translations. If <code>raw</code> is passed then <code>Translation[]</code> '
                + 'will be returned, otherwise <code>TranslationQueryResult</code>'
        }
    })
    @Get('/v2/translations/:type(anime|manga)/:id(\\d+)')
    @Get('/v2/translations/:type(anime|manga)/:id(\\d+)/parts/:part(-?\\d+)')
    async getTranslations (
        @Param('type') mediaType: MediaType,
        @Param('id') mediaId: number,
        @QueryParams() params: GetTranslationsParameters,
        // @Param('part') part?: number, // routing-controllers doesnt like this
        @Ctx() ctx: Context
    ) {
        params.target_type = mediaType
        params.target_id = mediaId
        params.part = ctx.params.part
        return this.service.getTranslations(params)
    }

    @Endpoint({
        name: 'Get recent translations',
        description: 'Get translations that were recently added. Has a hard limit of 15 items.',
        params: {
            type: {
                type: '"anime" | "manga"',
                description: 'Media type'
            }
        },
        query: {
            $extends: 'GetTranslationsParameters'
        },
        returns: {
            type: 'Translation[]',
            description: 'List of recent translations.'
        }
    })
    @Get('/v2/translations/:type(anime|manga)/recent')
    async getRecentUpdates (
        @Param('type') mediaType: MediaType
    ) {
        return this.service.getRecentUpdates(mediaType)
    }

    @Endpoint({
        name: 'Get translations',
        description: 'Get translations by ids',
        query: {
            ids: {
                type: 'number[]',
                description: 'Comma-separated list of translation ids'
            }
        },
        returns: {
            type: 'Translation[]',
            description: 'List of requested translations. Note that if some translations do not exist it will silently fail.'
        }
    })
    @Get('/v2/translations')
    async getTranslationsByIds (
        @QueryParam('ids') idsString: string
    ) {
        let ids = idsString.split(',').map(i => parseInt(i)).filter(i => !isNaN(i))

        return this.service.getTranslations({
            id: In(ids),
            raw: true
        })
    }

    // ! WARNING !
    // a lot of cringy flex ahead because of backwards-compatibility.
    // to be removed asap.

    @Endpoint({
        name: 'Get available media parts',
        description: 'Returns list of available media parts (ones that have at least one translation).',
        params: {
            id: {
                type: 'number',
                description: 'Anime ID (MAL)'
            }
        },
        returns: {
            type: 'number[]',
            description: 'List of available media parts'
        }
    })
    @Get('/v2/anime/:id(\\d+)/episodes')
    @Get('/anime/v2/:id(\\d+)/episodes')
    @Get('/anime/:id(\\d+)/episodes')
    @Get('/v2/translations/:type(anime|manga)/:id(\\d+)/parts')
    async getAvailableParts (
        @Param('id') animeId: number,
        @Ctx() ctx: Context
    ) {
        return this.service.getAvailableParts(animeId, ctx.params.type ?? MediaType.anime)
    }

    @Endpoint({
        name: 'Query anime translations',
        description: 'Query anime translations by parameters. Deprecated in favor of v2 translations API.',
        query: {
            $extends: 'GetTranslationsParameters',
            formatted: {
                type: 'presence',
                description: 'Opposite of <code>raw</code>'
            },
            anime: {
                type: 'string | string[]',
                checks: [
                    {
                        name: 'count',
                        params: {
                            max: 10
                        }
                    }
                ],
                description: 'Anime id or ids (comma-separated)'
            },
            target: {
                type: 'string | string[]',
                description: 'Same as <code>anime</code>'
            }
        },
        returns: {
            type: 'Translation[] | TranslationQueryResult',
            description: 'List of matching translations. If <code>formatted</code> is passed then <code>TranslationQueryResult</code> will be returned, otherwise <code>Translation[]</code>'
        }
    })
    @Deprecated()
    @Get('(/v2)?/anime/(query)?')
    async queryAnime (
        @QueryParams() params: GetTranslationsParametersCompat
    ) {
        params.raw = !('formatted' in params)
        params.target_id = (params.target ?? params.anime ?? '').split(',').map(i => parseInt(i)).filter(i => !isNaN(i))

        if (params.target_id.length > 10 || params.target_id.length === 0) {
            ApiValidationError.e('you can specify no more that 10 anime ids.')
        }

        if (params.episode) {
            params.part = params.episode
        }

        params.target_type = MediaType.anime
        params.renameAsAnime = true

        delete params.target
        delete params.anime
        delete params.episode

        return this.service.getTranslations(params)
    }

    @Endpoint({
        name: 'Get anime translations by anime ID',
        description: 'Get anime translations by anime ID. Deprecated in favor of v2 translations API.',
        params: {
            id: {
                type: 'number',
                description: 'Anime ID (MAL)'
            }
        },
        query: {
            $extends: 'GetTranslationsParameters'
        },
        returns: {
            type: 'Translation[] | TranslationQueryResult',
            description: 'List of matching translations. If <code>raw</code> is passed then <code>Translation[]</code> will be returned, otherwise <code>TranslationQueryResult</code>'
        }
    })
    @Deprecated()
    @Get('/v2/anime/:id(\\d+)')
    @Get('/anime/v2/:id(\\d+)')
    async getAnimeById (
        @Param('id') animeId: number,
        @QueryParams() params: GetTranslationsParameters
    ) {
        params.target_id = animeId
        params.target_type = MediaType.anime
        params.renameAsAnime = true

        return this.service.getTranslations(params)
    }

    @Endpoint({
        name: 'Get anime translations by anime ID and episode',
        description: 'Get anime translations by anime ID and episode number. Deprecated in favor of v2 translations API.',
        params: {
            id: {
                type: 'number',
                description: 'Anime ID (MAL)'
            },
            episode: {
                type: 'number',
                description: 'Episode number (starts from 1)'
            }
        },
        query: {
            $extends: 'GetTranslationsParameters'
        },
        returns: {
            type: 'Translation[] | TranslationQueryResult',
            description: 'List of matching translations. If <code>raw</code> is passed then <code>Translation[]</code> will be returned, otherwise <code>TranslationQueryResult</code>'
        }
    })
    @Deprecated()
    @Get('/v2/anime/:id(\\d+)/episode(s)?/:episode(-?\\d+)')
    @Get('/anime/v2/:id(\\d+)/episode(s)?/:episode(-?\\d+)')
    async getAnimeByIdAndEpisode (
        @Param('id') animeId: number,
        @Param('episode') episode: number,
        @QueryParams() params: GetTranslationsParameters
    ) {
        params.part = episode
        return this.getAnimeById(animeId, params)
    }

    @Endpoint({
        name: 'Get translation',
        description: 'Get a single translation',
        params: {
            id: {
                type: 'number',
                description: 'Translation ID'
            }
        },
        query: {
            needUploader: {
                type: 'presence',
                description: 'If present, uploader object will be added to result.'
            }
        },
        returns: {
            type: 'Translation | null',
            description: 'Requested translation or null if it does not exist'
        }
    })
    @Get('/v2/translation/:id(\\d+)')
    @Get('/v2/translations/:id(\\d+)')
    @Get('/translation/:id(\\d+)')
    @Get('/translations/:id(\\d+)')
    async getTranslation (
        @Param('id') translationId: number,
        @Session() session: ISession,
        @QueryParam('needUploader') needUploader?: string
    ) {
        const translation = await this.service.getSingleTranslation(translationId, {
            needUploader: needUploader !== undefined,
            full: true
        })

        let isModerator = session.userId && await this.userService.isModerator(session.userId)

        if (!translation) return null
        if (translation.status !== TranslationStatus.Added && translation.uploader_id !== session.userId && !isModerator) {
            ApiError.e('ACCESS_DENIED', 'This translation is not yet approved by moderator')
        }
        return isModerator ? translation : translation.stripHidden()
    }

    @Endpoint({
        private: true
    })
    @Get('/anime/:id(\\d+)')
    @Deprecated()
    async _deprecatedGetById (
        @Param('id') animeId: number
    ) {
        return this.service.compatAdapter(
            await this.service.getTranslations({
                target_id: animeId,
                target_type: MediaType.anime,
                renameAsAnime: true
            })
        )
    }

    @Endpoint({
        private: true
    })
    @Get('/anime/:id(\\d+)/episode/:episode(-?\\d+)')
    @Deprecated()
    async _deprecatedGetByEpisode (
        @Param('id') animeId: number,
        @Param('episode') episode: number
    ) {
        return this.service.compatAdapter(
            await this.service.getTranslations({
                target_id: animeId,
                target_type: MediaType.anime,
                part: episode,
                renameAsAnime: true
            })
        )
    }
}
