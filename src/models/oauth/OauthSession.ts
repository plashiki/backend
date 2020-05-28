import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm'
import { OauthApp } from '@/models/oauth/OauthApp'
import { User } from '@/models/User'

@Entity()
export class OauthSession extends BaseEntity {
    @PrimaryColumn()
    token: string

    @Column({ nullable: true })
    app_id: number

    @ManyToOne(() => OauthApp, app => app.id)
    app: OauthApp

    @Column({ nullable: true })
    user_id: number

    @ManyToOne(() => User, user => user.id)
    user: User

    @Column({
        default: 0
    })
    captcha: number
}
