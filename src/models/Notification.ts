import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { PushService } from '@/services/PushService'
import { AnyKV } from '@/types/utils'
import { EntityConstructor, EntityField } from '@/decorators/docs'

@EntityConstructor({
    description: 'A single notification'
})
@Entity()
export class Notification extends BaseEntity {
    @EntityField({
        description: 'Unique notification ID'
    })
    @PrimaryGeneratedColumn()
    id: number

    @EntityField({
        description: 'Notification tag containing brief meta info about notification for quick removal. '
            + 'Example: <code>mod-tr:123</code> = new translation on moderation with id 123.<br>'
    })
    @Column({
        select: false,
        default: ''
    })
    tag: string

    @EntityField({
        description: 'Time when notification was last updated'
    })
    @UpdateDateColumn()
    time: Date

    @EntityField({
        description: 'Notification progress. Float in range <code>0..1</code> and a special value <code>-1</code> means indeterminate state.'
    })
    @Column({
        type: 'float',
        default: 1
    })
    progress: number

    @EntityField({
        description: 'Notification target users.'
    })
    @Column({
        nullable: true,
        default: null,
        type: 'int',
        array: true,
        select: false
    })
    for_users: number[]

    @EntityField({
        description: 'Whether the notification should be displayed in UI as deleted.'
    })
    @Column({
        default: false
    })
    deleted: boolean

    @EntityField({
        description: 'Notification topics.'
    })
    @Column({
        type: 'text',
        array: true,
        default: '{}'
    })
    topics: string[]

    @EntityField({
        description: 'Notification payload.'
    })
    @Column({
        type: 'json',
        nullable: true,
        default: null
    })
    payload: any


    send (realTime = false): Promise<void> {
        return PushService.instance.sendNotification(this, realTime)
    }

    updateProgress (value: number, payload?: AnyKV): Promise<void> {
        return PushService.instance.updateNotification(this, value, payload)
    }

    delete (): Promise<void> {
        return PushService.instance.deleteNotification(this)
    }
}
