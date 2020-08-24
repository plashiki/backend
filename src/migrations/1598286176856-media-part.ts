import { MigrationInterface, QueryRunner } from 'typeorm'

export class MediaPart1598286176856 implements MigrationInterface {
    name = 'MediaPart1598286176856'
    
    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`CREATE TYPE "media_parts_media_type_enum" AS ENUM('anime', 'manga')`, [])
        await runner.query(`CREATE TABLE "media_parts" ("id" SERIAL NOT NULL, "media_type" "media_parts_media_type_enum" NOT NULL, "media_id" integer NOT NULL, "number" integer NOT NULL, "title" character varying NOT NULL, CONSTRAINT "PK_355ea3e04e0e07443377a5e7058" PRIMARY KEY ("id"))`, [])
        await runner.query(`CREATE UNIQUE INDEX "IDX_045077f771a6e2af0dd9b4866b" ON "media_parts" ("media_type", "media_id", "number") `, [])
    }
    
    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`DROP TYPE "media_parts_media_type_enum"`, [])
        await runner.query(`DROP TABLE "media_parts"`, [])
        await runner.query(`DROP INDEX "IDX_045077f771a6e2af0dd9b4866b"`, [])
    }
}
