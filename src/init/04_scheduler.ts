import schedule from 'node-schedule'
import { RelationsParser } from '@/helpers/relations'
import { ParsersService } from '@/services/ParsersService'
import { isProduction } from '@/config'

export default function scheduler (): void {
    if (!isProduction) return

    // At minute 42 past hour 0, 6, 12, and 18.
    schedule.scheduleJob('42 0,6,12,18 * * *', async () => {
        ParsersService.instance.runParsersGroup('importers')
    })

    // At 13:37 on Sunday, Tuesday, and Thursday.
    schedule.scheduleJob('37 13 * * 0,2,4', async () => {
        ParsersService.instance.runParsersGroup('mappers')
    })

    // At 20:20 every 2nd day.
    schedule.scheduleJob('20 20 * * */2', async () => {
        ParsersService.instance.runParsersGroup('cleaners')
    })

    // At 14:48 every day.
    schedule.scheduleJob('48 14 * * *', async () => {
        // update relations cache
        await RelationsParser.instance.load()
        await RelationsParser.instance.saveToFile('relations.json')
    })
}
