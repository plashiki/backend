import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm'
import { EntityConstructor, EntityField } from '@/decorators/docs'
import { Expose } from 'class-transformer'
import { IsBoolean, IsString } from 'class-validator'

@EntityConstructor({
    description: 'Parser is a piece of JS code + meta information for some actions, whose method of handling may '
        + 'change at all times. We use them to store (currently) 3 types of parsers -- Importers, Cleaners and Mappers. <br><br>'

        + '<b>Importers</b> are scripts that run every so often (on a schedule) and which task is to '
        + 'grab some translations from some services and import them all to our DB. They should contain a '
        + '<code>function(){...}</code> expression, where the returned function should return an async '
        + 'iterable (or compatible) of <code>Translation</code><br><br>'

        + '<b>Cleaners</b> are scripts that remove old and banned players from database. They should contain a'
        + '<code>function(){}</code> expression, where the returned function should return an async '
        + 'iterable (or compatible) of integers, ids of translations to be removed. '
        + 'In params, they have access to TypeORM Translation entity (<code>ctx.params.Translation</code>)<br><br>'

        + '<b>Mappers</b> are scripts that grab external websites\' media ids and try to map them with MAL ids, which '
        + 'are used by PlaShiki. They should contain a <code>function(){...}</code> expression, where the returned '
        + 'function should return <code>ExternalServiceMappings</code> or <code>Promise&lt;ExternalServiceMappings&gt;</code><br><br>'

        + 'All of them receive a <code>ParserContext</code> object as an argument, which is described in types/ctx.ts at '
        + '<a href="//github.com/plashiki/plashiki-parsers">plashiki-parsers</a> repository.'
})
@Entity('parsers')
export class Parser extends BaseEntity {
    @Expose()
    @IsString()
    @EntityField({
        description: 'Uid of a parser. Is globally unique. '
            + 'Importers\' uid start with <code>importers/</code>, '
            + 'Cleaners\' uid start with <code>cleaners/</code> and '
            + 'Mappers\' uid start with <code>mappers/</code>. '
    })
    @PrimaryColumn()
    uid: string

    @Expose()
    @IsString({ each: true })
    @EntityField({
        description: 'Dependencies of a parser. A parser can contain some dependencies, '
            + 'for example to abstract parsing logic of a single platform but keep different '
            + 'parsers for different authors. Nested dependencies are supported, circular are not'
    })
    @Column('text', {
        array: true,
        default: '{}'
    })
    provide: string[]

    @Expose()
    @IsString({ each: true })
    @EntityField({
        description: 'List of used storage keys by a parser. This list may not be exhaustive, '
            + 'and is only used for parser dashboard. This DOES NOT affect parser\'s runtime permissions or whatever. '
            + 'May include SQL patterns, for example <code>name:%</code>'
    })
    @Column('text', {
        array: true,
        default: '{}'
    })
    storage: string[]

    @Expose()
    @IsBoolean()
    @EntityField({
        description: 'When a parser is disabled, it will not be started on schedule (in case of an Importer/Mapper) '
            + 'This WILL NOT disable importing it as a dependency.'
    })
    @Column({
        default: false
    })
    disabled: boolean

    @Expose()
    @IsString()
    @EntityField({
        description: 'When a parser is public, anyone can run it. '
            + 'Possible values: <code>\'\'</code> (empty string) = non-public'
            + '<code>true</code> = public'
            + '<code>N,M</code> = public with rate-limit: N requests every M seconds'
    })
    @Column({
        default: ''
    })
    public: string

    @Expose()
    @IsBoolean()
    @EntityField({
        description: 'Constantly running importer. If true then this importer will ' +
            'be running all the time while server is up in a worker thread. ' +
            '(however it wont be restarted after worker is dead, i.e. function returns). ' +
            'Only applicable to Importers.'
    })
    @Column({
        default: false
    })
    cri: boolean

    @Expose()
    @IsString()
    @EntityField({
        description: 'JavaScript code'
    })
    @Column()
    code: string

    @Expose()
    @IsString()
    @EntityField({
        description: 'Original source code of a file. GZipped. Used only for pulling.'
    })
    @Column('bytea', {
        select: false
    })
    source: string

    @EntityField({
        description: 'MD5 hash of a parser. Calculated as follows: <br>' +
            '<code>md5(p.uid + \'\\n\\n\' + p.provide.sort().join(\',\') + \'\\n\\n\' + p.code)</code>. <br>' +
            'Used to keep track of changed parsers when pushing/pulling them'
    })
    @Column()
    hash: string

    // helper field
    dependencies: Record<string, Parser>
}
