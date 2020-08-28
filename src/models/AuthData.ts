import { BaseEntity, Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from '@/models/User'
import { ConnectableService } from '@/types/media'
import { EntityConstructor } from '@/decorators/docs'

export interface AuthOptions {
    token: string
    refresh?: string
    expires?: number
}

@EntityConstructor({
    private: true
})
@Entity()
export class AuthData extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    user_id: number

    @Index()
    @ManyToOne(() => User, user => user.id)
    user: User

    @Column({
        type: 'enum',
        enum: ConnectableService
    })
    service: ConnectableService

    @Column({
        type: 'json'
    })
    options: AuthOptions
}
