import { LOG } from '@/helpers/logging'
import typeOrmLoader from '@/init/00_typeorm-loader'
import { parsersState } from '@/workers/parsers/state'
import { runImporters } from '@/workers/parsers/importers'
import { runMappers } from '@/workers/parsers/mappers'
import { runCleaners } from '@/workers/parsers/cleaners'
import { TranslationService } from '@/services/TranslationService'

let translationService = new TranslationService()
let typeorm: boolean | Promise<void> = false

process.on('message', function onMessage (e) {
    // ensure typeorm is loaded
    if (typeorm === false) {
        typeorm = typeOrmLoader().then(() => {
            typeorm = true
            onMessage(e)
        })
        return
    }
    if (typeorm !== true) {
        typeorm.then(() => onMessage(e))
        return
    }

    if (!e || !e.act) return

    if (e.act === 'run-importers' && !parsersState.importers.running) {
        parsersState.importers.running = true
        runImporters(translationService, e.only).catch(LOG.parsers.error).then(() => {
            parsersState.importers.running = false
        })
    }

    if (e.act === 'run-mappers' && !parsersState.mappers.running) {
        parsersState.mappers.running = true
        runMappers(e.only).catch(LOG.parsers.error).then(() => {
            parsersState.mappers.running = false
        })
    }

    if (e.act === 'run-cleaners' && !parsersState.cleaners.running) {
        parsersState.cleaners.running = true
        runCleaners(e.only).catch(LOG.parsers.error).then(() => {
            parsersState.cleaners.running = false
        })
    }

    if (e.act === 'state') {
        process.send!({ state: parsersState, rid: e.rid })
    }
})
