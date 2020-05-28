import { StatisticsDay } from '@/models/StatisticsDay'

export class StatisticsService {
    async getDayRange (from: Date, to: Date): Promise<StatisticsDay[]> {
        from.setHours(0, 0, 0, 0)
        to.setHours(0, 0, 0, 0)

        return StatisticsDay.createQueryBuilder()
            .where('day >= :from', { from })
            .andWhere('day <= :to', { to })
            .getMany()
    }
}
