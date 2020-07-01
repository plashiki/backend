import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotificationTag1593600626358 implements MigrationInterface {
    name = 'NotificationTag1593600626358'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "notification" ADD "tag" character varying NOT NULL DEFAULT ''`, [])
    }

    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "notification" DROP COLUMN "tag"`, [])
    }
}
