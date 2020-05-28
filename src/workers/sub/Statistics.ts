import { Worker } from 'bullmq'
import { StatisticsDay } from '@/models/StatisticsDay'

new Worker('Statistics', async ({ name, data }) => {
    if (name === 'stat-event') {
        await StatisticsDay.increment(data.name + (data.source ?? ''), data.count || 1)
    }
})
