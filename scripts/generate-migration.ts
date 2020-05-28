// Basically taken from https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationGenerateCommand.ts
// and slightly modified
import { createConnection } from 'typeorm'
import { Query } from 'typeorm/driver/Query'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { camelCase } from 'typeorm/util/StringUtils'
import { connectionOptions } from '@/init/00_typeorm-loader'

const capitalize = (s: string): string => s[0].toUpperCase() + s.substr(1)

async function main (): Promise<void> {
    const name = process.argv[2]
    if (!name) {
        console.log('Usage: ' + process.argv[1] + ' <migration-name>')
        return
    }

    const conn = await createConnection({
        ...connectionOptions,
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
        logging: false
    })

    const sql = await conn.driver.createSchemaBuilder().log()
    let prepare = (q: Query): string => {
        // holy shit
        return `await runner.query(\`${q.query.replace(/`/g, '\\`')}\`, [${
            q.parameters?.map(i => `'${i.replace(/'/g, '\\\'')}'`) ?? ''}])`
    }

    // removing set default because it finds them mistakingly, see https://github.com/typeorm/typeorm/issues/3076
    // however this means that
    const ups = sql.upQueries.map(prepare).filter(i => !i.match(/ALTER TABLE ".+" ALTER COLUMN ".+" (SET|DROP) DEFAULT/i))
    const downs = sql.downQueries.map(prepare).filter(i => !i.match(/ALTER TABLE ".+" ALTER COLUMN ".+" (SET|DROP) DEFAULT/i))

    const now = Date.now()

    const filename = join(process.cwd(), `src/migrations/${now}-${name}.ts`)
    if (!ups.length) {
        console.error('WARN: No changes in schema found!')
    }

    const migrationName = `${capitalize(camelCase(name))}${now}`

    const prepareJs = (ar: string[]): string => ar.length ? ar.join('\n        ') : '// TODO'

    // language=TypeScript
    writeFileSync(filename, `
import { MigrationInterface, QueryRunner } from 'typeorm'

export class ${migrationName} implements MigrationInterface {
    name = '${migrationName}'
    
    async up (runner: QueryRunner): Promise<any> {
        ${prepareJs(ups)}
    }
    
    async down (runner: QueryRunner): Promise<any> {
        ${prepareJs(downs)}
    }
}
`.trimLeft())

    await conn.close()

    console.log('OK! Generated migration. Dont forget to add SET DEFAULT queries!')
    process.exit(0)
}

main().catch(console.error)
