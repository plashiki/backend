import { BodyParam, Controller, Get, Post, QueryParams } from 'routing-controllers'
import { UserService } from '@/services/UserService'
import { Endpoint } from '@/decorators/docs'
import { RequireFlag } from '@/decorators/auth-decorators'
import { appendToGithubFile } from '@/external/github'
import { github } from '@/config'
import { PaginatedSorted } from '@/types/api'

@Endpoint({
    name: 'Control users',
    description: 'Admin-only features related to users.'
})
@RequireFlag('admin')
@Controller('/v2/admin')
export default class UserAdminController {
    service = new UserService()

    @Endpoint({
        name: 'Get users',
        description: 'Get list of users',
        query: {
            $extends: 'PaginatedSorted'
        },
        returns: {
            type: 'User[]'
        }
    })
    @Get('/users/list')
    async getUsersList (
        @QueryParams() params: PaginatedSorted
    ) {
        return this.service.getUsersList(params)
    }

    @Endpoint({
        name: 'Add donation/expense',
        description: 'Add a donation or expense. Will automatically update associated Github file.',
        body: {
            type: 'object',
            fields: {
                type: {
                    type: '"donation" | "expense"',
                    description: 'Whether passed entity is a donation or an expense'
                },
                date: {
                    type: 'string',
                    description: 'Date of change in format: "DD.MM.YYYY в HH:MM".'
                },
                amount: {
                    type: 'number',
                    description: 'Amount of expense/donation in rubles (RUB)'
                },
                comment: {
                    type: 'string',
                    description: 'Comment for an entity. For a donation, if a user nickname is passed '
                        + 'and user with such nickname exists, a donation will be added to their counter automatically. '
                        + 'For expense, should be a human-readable expense destination'
                }
            }
        },
        returns: {
            type: '"OK"'
        }
    })
    @Post('/budget')
    async updateBudget (
        @BodyParam('type') type: 'donation' | 'expense',
        @BodyParam('amount') amount: number,
        @BodyParam('comment') comment: string,
        @BodyParam('date') date: string
    ) {
        if (type === 'donation') {
            let user = await this.service.getUserByNickname(comment)
            if (user) {
                user.donated += amount
                await user.save()
            }
        }

        let line = `${date}|${type === 'donation' ? '+' : '-'}${amount} ${type === 'donation' ? 'от ' : ''}${comment}\n`
        await appendToGithubFile(github.donationsRepo, github.donationsFile, line)
        return 'OK'
    }
}
