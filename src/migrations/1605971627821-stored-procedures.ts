import { MigrationInterface, QueryRunner } from 'typeorm'

export class StoredProcedures1605971627821 implements MigrationInterface {
    name = 'StoredProcedures1605971627821'

    async up (runner: QueryRunner): Promise<any> {
        // insane magic dont touch lol

        // language=PostgreSQL
        await runner.query(`
            create or replace function translations_bulk_insert(a1 int[],
                                                                a2 translations_target_type_enum[],
                                                                a3 int[],
                                                                a4 translations_kind_enum[],
                                                                a5 translations_lang_enum[],
                                                                a7 jsonb[],
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
                            uploader_id integer,
                            status      translations_status_enum,
                            url         varchar,
                            groups      text[],
                            created_at  timestamp,
                            updated_at  timestamp,
                            author      jsonb,
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
        runner.query('drop function if exists get_parsers_recursive')
        runner.query('drop function if exists get_translation_count')
        runner.query('drop function if exists get_translations_in_part')
        runner.query('drop function if exists get_translations_same_meta')
        runner.query('drop function if exists translations_bulk_insert')
    }
}
