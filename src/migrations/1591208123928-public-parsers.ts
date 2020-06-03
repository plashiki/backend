import { MigrationInterface, QueryRunner } from 'typeorm'

export class PublicParsers1591208123928 implements MigrationInterface {
    name = 'PublicParsers1591208123928'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "parsers" ADD COLUMN "public" text DEFAULT ''`, [])
    }

    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "parsers" DROP COLUMN "public"`, [])
    }
}
