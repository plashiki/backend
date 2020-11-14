import { MigrationInterface, QueryRunner } from 'typeorm'

export class ReportClosedBy1605367694028 implements MigrationInterface {
    name = 'ReportClosedBy1605367694028'
    
    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "reports" ADD "closed_by_id" integer`, [])
        await runner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_49eb3c9ff12e35856492bb7ceb1" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, [])
    }
    
    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "reports" DROP COLUMN "closed_by_id"`, [])
        await runner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_49eb3c9ff12e35856492bb7ceb1"`, [])
    }
}
