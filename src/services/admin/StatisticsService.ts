import { StatisticsDay } from '@/models/StatisticsDay'

export class StatisticsService {
    async getDayRange (from: Date, to: Date): Promise<StatisticsDay[]> {
        from.setHours(0, 0, 0, 0)
        to.setHours(0, 0, 0, 0)

        return StatisticsDay.createQueryBuilder('s')
            .where('s.day >= :from', { from })
            .andWhere('s.day <= :to', { to })
            .getMany()
    }
}
