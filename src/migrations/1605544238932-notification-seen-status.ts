import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotificationSeenStatus1605544238932 implements MigrationInterface {
    name = 'NotificationSeenStatus1605544238932'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "notification" ADD "users_seen" integer array DEFAULT '{}'`, [])
    }

    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "notification" DROP COLUMN "users_seen"`, [])
    }
}
