import { createWriteStream } from 'fs'
import { join } from 'path'
import Mapping from '@/models/Mapping'
import { LOG } from '@/helpers/logging'
import { createGzip } from 'zlib'

export async function dumpAllMappings (): Promise<void> {
    LOG.workers.verbose('Dumping all mappings')
    const fs = createWriteStream(join(process.env.STATIC_DIR!, 'mappings.json.gz'))
    const gz = createGzip()
    gz.pipe(fs)
    await new Promise((res, rej) => gz.write(`{"ts":"${Date.now()}","items":[`, (err) => err ? rej(err) : res()))

    let offset = 0
    let first = true
    while (true) {
        const chunk = await Mapping.find({
            take: 5000,
            skip: offset
        })

        if (!chunk.length) break

        for (let it of chunk) {
            await new Promise((res, rej) => gz.write(
                (first ? '' : ',') + JSON.stringify(it),
                (err) => err ? rej(err) : res())
            )
            if (first) {
                first = false
            }
        }

        offset += chunk.length
    }
    await new Promise((res, rej) => gz.write(']}', (err) => err ? rej(err) : res()))
    await new Promise(res => gz.end(res))
    LOG.workers.verbose('Dumped %d mappings', offset)
}