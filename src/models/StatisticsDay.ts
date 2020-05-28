import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('stats')
export class StatisticsDay extends BaseEntity {
    @PrimaryColumn({
        type: 'date'
    })
    day: Date

    @Column({
        type: 'json'
    })
    data: Record<string, number>

    static async today (): Promise<StatisticsDay> {
        let today = new Date()
        today.setHours(0, 0, 0, 0)

        return await StatisticsDay.findOne({ day: today }) ?? StatisticsDay.create({
            day: today,
            data: {}
        })
    }

    static async increment (type: string, by = 1): Promise<StatisticsDay> {
        const old = await this.today()

        return old.increment(type, by).save()
    }

    increment (type: string, by = 1): StatisticsDay {
        if (!(type in this.data)) {
            this.data[type] = 0
        }
        this.data[type] += by

        return this
    }
}
