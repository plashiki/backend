import { MigrationInterface, QueryRunner } from 'typeorm'

export class StoredProcedures1589054972807 implements MigrationInterface {
    name = 'StoredProcedures1589054972807'

    async up (runner: QueryRunner): Promise<any> {
        // insane magic dont touch lol

        // language=PostgreSQL
        runner.query(`
            create function get_parsers_recursive(root_uids text[], cached_uids text[]) returns setof parsers as
            $$
            begin
                return query
                    with
                        recursive
                        deps as (
                            select *
                            from parsers
                            where uid = any (root_uids)
                            union
                            select p.*
                            from parsers p
                                     inner join deps d
                                                on p.uid = any (d.provide)
                                                    and p.uid <> all (cached_uids)
                        )
                    select *
                    from deps;
            end
            $$ language plpgsql
        `)
        // language=PostgreSQL
        runner.query(`
            create or replace function get_translation_count(target_id_ int, target_type_ translations_target_type_enum,
                                                             part_ int,
                                                             kind_ translations_kind_enum, lang_ translations_lang_enum)
                returns table
                        (
                            in_part   bigint,
                            same_meta bigint
                        )
            as
            $$
            begin
                return query
                    select (select count(1) as in_part
                            from translations
                            where target_id = target_id_
                              and target_type = target_type_
                              and part = part_
                              and url not like 'https://smotret-anime%'
                              and status = 'added'
                           ),
                           (select count(1) as same_meta
                            from translations
                            where target_id = target_id_
                              and target_type = target_type_
                              and part = part_
                              and kind = kind_
                              and lang = lang_
                              and url not like 'https://smotret-anime%'
                              and status = 'added');
            end
            $$ language plpgsql;
        `)
        // language=PostgreSQL
        runner.query(`
            create or replace function get_translations_in_part(item translations) returns bigint as
            $$
            select count(1) as in_part
            from translations
            where target_id = item.target_id
              and target_type = item.target_type
              and part = item.part
              and url not like 'https://smotret-anime%'
              and status = 'added'
            $$ language sql;
        `)
        // language=PostgreSQL
        runner.query(`
            create or replace function get_translations_same_meta(item translations) returns bigint as
            $$
            select count(1) as same_meta
            from translations
            where target_id = item.target_id
              and target_type = item.target_type
              and part = item.part
              and kind = item.kind
              and lang = item.lang
              and url not like 'https://smotret-anime%'
              and status = 'added'
            $$ language sql;
        `)
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
        runner.query('drop function if exists get_parsers_recursive')
        runner.query('drop function if exists get_translation_count')
        runner.query('drop function if exists get_translations_in_part')
        runner.query('drop function if exists get_translations_same_meta')
        runner.query('drop function if exists translations_bulk_insert')
    }
}
