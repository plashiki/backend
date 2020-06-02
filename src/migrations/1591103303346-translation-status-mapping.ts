import { MigrationInterface, QueryRunner } from 'typeorm'

export class TranslationStatusMapping1591103303346 implements MigrationInterface {
    name = 'TranslationStatusMapping1591103303346'

    async up (runner: QueryRunner): Promise<any> {
        await runner.query(`ALTER TYPE "public"."translations_status_enum" RENAME TO "translations_status_enum_old"`, [])
        await runner.query(`CREATE TYPE "translations_status_enum" AS ENUM('pending', 'added', 'declined', 'mapping')`, [])
        await runner.query(`ALTER TABLE "translations" ALTER COLUMN "status" TYPE "translations_status_enum" USING "status"::"text"::"translations_status_enum"`, [])
        await runner.query(`drop function if exists translations_bulk_insert`, [])
        await runner.query(`DROP TYPE "translations_status_enum_old"`, [])
        // language=PostgreSQL
        runner.query(`
            create or replace function translations_bulk_insert(a1 int[],
                                                                a2 translations_target_type_enum[],
                                                                a3 int[],
                                                                a4 translations_kind_enum[],
                                                                a5 translations_lang_enum[],
                                                                a6 bool[],
                                                                a7 text[],
                                                                a8 text[],
                                                                a9 text[],
                                                                a10 translations_status_enum[])
                returns table
                        (
                            id          integer,
                            target_id   integer,
                            target_type translations_target_type_enum,
                            part        integer,
                            kind        translations_kind_enum,
                            lang        translations_lang_enum,
                            hq          boolean,
                            author      varchar,
                            uploader_id integer,
                            status      translations_status_enum,
                            url         varchar,
                            groups      text[],
                            created_at  timestamp,
                            updated_at  timestamp,
                            in_part     bigint,
                            same_meta   bigint
                        )
            as
            $$
            begin
                return query
                    with raw as (
                        select *
                        from unnest(
                                a1,
                                a2,
                                a3,
                                a4,
                                a5,
                                a6,
                                a7,
                                a8,
                                a9,
                                a10
                            )
                        )
                        insert into translations (
                                                  target_id,
                                                  target_type,
                                                  part,
                                                  kind,
                                                  lang,
                                                  hq,
                                                  author,
                                                  url,
                                                  groups,
                                                  status
                            )
                            select *
                            from (
                                     select r.target_id,
                                            r.target_type,
                                            r.part,
                                            r.kind,
                                            r.lang,
                                            r.hq,
                                            r.author,
                                            r.url,
                                            string_to_array(r.groups, '||') as groups,
                                            r.status
                                     from raw r (
                                                 target_id,
                                                 target_type,
                                                 part,
                                                 kind,
                                                 lang,
                                                 hq,
                                                 author,
                                                 url,
                                                 groups,
                                                 status
                                         )
                                 ) t
                            on conflict do nothing
                            returning *,
                                translations.get_translations_in_part as in_part,
                                translations.get_translations_same_meta as same_meta;
            end;
            $$ language plpgsql;
        `)
    }

    async down (runner: QueryRunner): Promise<any> {
        await runner.query(`CREATE TYPE "translations_status_enum" AS ENUM('pending', 'added', 'declined')`, [])
        await runner.query(`ALTER TYPE "translations_status_enum" RENAME TO  "translations_status_enum_old"`, [])
        await runner.query(`ALTER TABLE "translations" ALTER COLUMN "status" TYPE "translations_status_enum" USING "status"::"text"::"translations_status_enum"`, [])
        await runner.query(`DROP TYPE "translations_status_enum_old"`, [])
    }
}
