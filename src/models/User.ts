import { BaseEntity, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { IsEnum, IsUrl } from 'class-validator'
import { ConnectableService } from '@/types'
import { EntityConstructor, EntityField } from '@/decorators/docs'

@EntityConstructor({
    description: 'A single user'
})
@Entity('users')
export class User extends BaseEntity {
    @EntityField({
        description: 'User\'s ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'User\'s nickname'
    })
    @Column()
    @Index({ unique: true })
    nickname: string

    @EntityField({
        description: 'Link to user\'s avatar.'
    })
    @Column('text', {
        nullable: true,
        default: null
    })
    @IsUrl()
    avatar?: string | null

    @EntityField({
        description: 'Whether the user is an admin.'
    })
    @Column({
        default: false
    })
    admin: boolean

    @EntityField({
        description: 'Whether the user is a moderator.'
    })
    @Column({
        default: false
    })
    moderator: boolean

    @EntityField({
        description: 'Whether the user is trusted.'
    })
    @Column({
        default: false
    })
    trusted: boolean

    @EntityField({
        description: 'Whether the user is banned. Banned users can\'t submit videos or reports'
    })
    @Column({
        default: false
    })
    banned: boolean

    @EntityField({
        description: 'User\'s donation amount.'
    })
    @Column({
        default: 0
    })
    donated: number

    @EntityField({
        description: 'User\'s first login time.'
    })
    @CreateDateColumn()
    first_login_at: Date

    @EntityField({
        description: 'User\'s external services ids',
        fields: {
            '%ConnectableService%': {
                type: 'string | number'
            }
        }
    })
    @Column({
        type: 'jsonb'
    })
    external_ids: Partial<Record<ConnectableService, string | number>>

    @EntityField({
        description: 'User\'s primary external service (is used for user rates). Only available for current user'
    })
    @IsEnum(ConnectableService)
    @Column()
    service: ConnectableService

    @EntityField({
        description: 'Topics that user is subscribed to. Only available for current user.'
    })
    @Column('text', {
        default: '{}',
        array: true
    })
    sub: string[]

    @EntityField({
        description: 'User\'s preferred language. Only available for current user.'
            + 'When <code>null</code> user hasn\'t set its preferred language yet, so use system-defined.'
    })
    @Column('text', {
        default: null,
        nullable: true
    })
    language?: string | null

    static findSubTargets (topics: string[], params: Partial<User> = {}): Promise<number[]> {
        if (!topics.length) return Promise.resolve([])
        return this.createQueryBuilder('u')
            .where(params)
            .andWhere('u.sub && :topics', { topics })
            .getMany()
            .then(i => i.map(it => it.id))
    }

    static hasFlag (id: number, flag: keyof User): Promise<boolean> {
        return this.createQueryBuilder('u')
            .select('u.' + flag)
            .where({ id })
            .getOne()
            .then(i => !!i?.[flag] ?? false)
    }
}
