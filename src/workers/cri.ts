import { LOG } from '@/helpers/logging'
import { Parser } from '@/models/Parser'
import { Like } from 'typeorm'
import { ParsersService } from '@/services/ParsersService'
import typeOrmLoader from '@/init/00_typeorm-loader'

const service = ParsersService.instance

async function main (): Promise<void> {
    await typeOrmLoader()

    const parsers = await Parser.find({
        where: {
            uid: Like('importers/%'),
            disabled: false,
            cri: true
        },
        select: ['uid']
    })

    await service.loadParsers(parsers.map(i => i.uid))

    if (parsers.length) {
        LOG.parsers.verbose('Loaded %d CRI-s', parsers.length)
        await Promise.all(parsers.map(i => service.executeParserByUid(i.uid)))
    } else {
        process.exit(0)
    }
}

main().catch(LOG.parsers.error)
