import { MigrationInterface, QueryRunner } from 'typeorm'

export class ComplexReports1605212106761 implements MigrationInterface {
    name = 'ComplexReports1605212106761'
    
    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "reports" ADD "is_complex" boolean NOT NULL DEFAULT false`, [])
    }
    
    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "reports" DROP COLUMN "is_complex"`, [])
    }
}
