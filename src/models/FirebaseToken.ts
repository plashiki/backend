import { BaseEntity, Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm'
import { User } from '@/models/User'
import { EntityConstructor } from '@/decorators/docs'

@EntityConstructor({
    private: true
})
@Entity()
export class FirebaseToken extends BaseEntity {
    @PrimaryColumn()
    token: string

    @Index()
    @Column()
    user_id: number

    @ManyToOne(() => User, user => user.id)
    user: User
}
