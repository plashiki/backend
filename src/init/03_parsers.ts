import { RelationsParser } from '@/helpers/relations'
import { ParsersService } from '@/services/ParsersService'
import { isProduction } from '@/config'

export default async function parsersLoader (): Promise<void> {
    // load relations from cache or from remote file
    try {
        RelationsParser.instance.loadFromFile('relations.json')
    } catch (e) {
        await RelationsParser.instance.load()
        await RelationsParser.instance.saveToFile('relations.json')
    }

    if (isProduction) {
        ParsersService.instance.startCriProcess()
        ParsersService.instance.startParsersProcess()
    }
}
