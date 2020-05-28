import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from '@/models/User'
import { EntityField } from '@/decorators/docs'

@Entity()
export class OauthApp extends BaseEntity {
    @EntityField({
        description: 'Application ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'Application client ID. Used when authorizing users via Implicit Flow'
    })
    @Column({
        select: false
    })
    client_id: string

    @EntityField({
        description: 'Application client secret. Used for server-to-server communication. Should be kept secret!'
    })
    @Column({
        select: false
    })
    client_secret: string

    @EntityField({
        description: 'Application owner user ID.'
    })
    @Column({ nullable: true })
    owner_id: number

    @EntityField({
        description: 'Application owner user. Only available when querying all applications as admin'
    })
    @ManyToOne(() => User, user => user.id)
    owner: User

    @EntityField({
        description: 'Application name. Displayed in user dashboard and when authorizing users.'
    })
    @Column()
    name: string

    @EntityField({
        description: 'Direct link to application icon. Optional, can be null' +
            'Icon Should be square, Recommended resolution is at least 128x128. <br>' +
            'We <b>DO NOT</b> host images!'
    })
    @Column({
        type: 'text',
        default: null
    })
    icon: string | null

    @EntityField({
        description: 'Application description. Is never displayed to end user, ' +
            'so can be used to distinguish between your own apps with same name & icon'
    })
    @Column({
        default: ''
    })
    description: string

    @EntityField({
        description: 'Application redirect_uri. Used when authorizing user via Implicit Flow.'
    })
    @Column({
        default: 'https://plashiki.su/static/oauth.blank.html',
        select: false
    })
    redirect_uri: string

    @EntityField({
        description: 'Permissions given to application when interacting ' +
            'directly with server using <code>client_secret</code>. Issued by administrators. <br>' +
            'Exact values are subject and are not documented, so if you want to display them - display as is.'
    })
    @Column('text', {
        default: '{}',
        array: true,
        select: false
    })
    server_scope: string[]
}
