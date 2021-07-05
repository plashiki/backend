import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm'
import { User } from '@/models/User'
import { EntityConstructor } from '@/decorators/docs'
import { TheEntity } from '@/helpers/typeorm-utils'

@EntityConstructor({
    private: true
})
@Entity()
export class FirebaseToken extends TheEntity {
    @PrimaryColumn()
    token: string

    @Index()
    @Column()
    user_id: number

    @ManyToOne(() => User, user => user.id)
    user: User
}
