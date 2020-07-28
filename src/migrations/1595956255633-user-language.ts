import { MigrationInterface, QueryRunner } from 'typeorm'

export class UserLanguage1595956255633 implements MigrationInterface {
    name = 'UserLanguage1595956255633'
    
    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "users" ADD "language" text DEFAULT null`, [])
    }
    
    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TABLE "users" DROP COLUMN "language"`, [])
    }
}
