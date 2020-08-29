import { MigrationInterface, QueryRunner } from 'typeorm'

export class ParsersStorage1598726454827 implements MigrationInterface {
    name = 'ParsersStorage1598726454827'
    
    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "parsers" ADD "storage" text array NOT NULL DEFAULT '{}'::text[]`, [])
    }
    
    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "parsers" DROP COLUMN "storage"`, [])
    }
}
