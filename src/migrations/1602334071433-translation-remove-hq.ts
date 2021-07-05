import { MigrationInterface, QueryRunner } from 'typeorm'

export class TranslationRemoveHq1602334071433 implements MigrationInterface {
    name = 'TranslationRemoveHq1602334071433'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "translations" DROP COLUMN "hq"`, [])
    }

    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "translations" ADD "hq" boolean NOT NULL default false`, [])
    }
}
