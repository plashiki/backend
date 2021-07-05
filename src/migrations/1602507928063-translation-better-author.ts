import { MigrationInterface, QueryRunner } from 'typeorm'
import { TranslationService } from '@/services/TranslationService'
import { LOG } from '@/helpers/logging'

export class TranslationBetterAuthor1602507928063 implements MigrationInterface {
    name = 'TranslationBetterAuthor1602507928063'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "translations" ADD "author_new" jsonb NOT NULL DEFAULT '{}'`, [])

        const service = new TranslationService()

        let offset = 0
        let logInterval = 0
        while (true) {
            // using plain sql because 1) orm doesn't know about our tmp column, 2) we don't want updated_at to change
            const chunk = await runner.query(`select id, author, author_new from translations order by id asc limit 5000 offset ${offset}`)
            if (!chunk.length) break

            offset += chunk.length

            for (let tr of chunk) {
                (tr as any).author_new = service.parseTranslationAuthor((tr as any).author)
            }

            const sql = `update translations as tr set author_new = ins.author_new from (values ${
                chunk.map((it, i) => `(${it.id}, $${i + 1}::jsonb)`).join(',')
            }) as ins(id, author_new) where tr.id = ins.id`

            await runner.query(sql, chunk.map(it => it.author_new))

            if (logInterval-- == 0) {
                logInterval = 5
                LOG.boot.info('Author migration: processed %d items', offset)
            }
        }

        await runner.query(`ALTER TABLE "translations" DROP COLUMN "author"`, [])
        await runner.query(`ALTER TABLE "translations" RENAME COLUMN "author_new" to "author"`, [])
    }

    async down (runner: QueryRunner): Promise<any> {
        throw new Error('Not implemented!') // but definitely possible, it's just me being lazy
    }
}
