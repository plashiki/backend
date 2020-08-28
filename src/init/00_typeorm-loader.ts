import 'reflect-metadata'
import { BaseEntity, ConnectionOptions, createConnection, getConnection, SelectQueryBuilder } from 'typeorm'
import { database, databaseType, isProduction } from '@/config'
import { join } from 'path'
import { QueryBuilder } from 'typeorm/query-builder/QueryBuilder'
import { WhereExpression } from 'typeorm/query-builder/WhereExpression'
import { Paginated, PaginatedResponse, PaginatedSorted } from '@/types/api'
import { TheNamingStrategy } from '@/helpers/typeorm-naming'
import { clone, merge, strip } from '@/helpers/object-utils'
import { numericToNumber } from '@/types/utils'
import { ApiError } from '@/types/errors'

export const connectionOptions: ConnectionOptions = {
    type: databaseType as any,
    url: database,
    entities: [
        join(__dirname, '../models/**/*.{ts,js}')
    ],
    migrations: [
        join(__dirname, '../migrations/*.{ts,js}')
    ],
    logging: isProduction ? ['migration', 'warn', 'error'] : true,
    namingStrategy: new TheNamingStrategy()
}

export default async function typeOrmLoader (connOptions: Partial<ConnectionOptions> = {}): Promise<void> {
    const conn = await createConnection(merge(clone(connectionOptions), connOptions))

    await conn.runMigrations()

    // monkeypatching ftw, lol
    // maybe i'd better create my own BaseEntity or smth, but idc for now

    // utility function to addSelect all hidden columns
    SelectQueryBuilder.prototype.addSelectHidden = function <T> (): SelectQueryBuilder<T> {
        if (!this.expressionMap.mainAlias) {
            throw new Error('Alias must be supplied for addSelectHidden')
        }
        if (!this.expressionMap.mainAlias._metadata.target._hiddenColumns) {
            this.expressionMap.mainAlias._metadata.target._hiddenColumns = this.expressionMap.mainAlias._metadata.columns
                .filter(i => !i.isSelect)
                .map(i => i.databaseName)
        }
        if (!this.expressionMap.mainAlias._metadata.target._hiddenColumnsAliased) {
            this.expressionMap.mainAlias._metadata.target._hiddenColumnsAliased = {}
        }
        if (!this.expressionMap.mainAlias._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name]) {
            this.expressionMap.mainAlias._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name] =
                this.expressionMap.mainAlias._metadata.target._hiddenColumns.map(i => `${this.expressionMap.mainAlias.name}.${i}`)
        }
        return this.addSelect(
            this.expressionMap.mainAlias._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name]
        )
    }

    // utility function to paginate (e.g. add limit and offset) at the same time
    SelectQueryBuilder.prototype.paginate = function <T> (p: Paginated, maxLimit: number | null = null): SelectQueryBuilder<T> {
        if (maxLimit) {
            if (!p.limit || numericToNumber(p.limit) > maxLimit) {
                p.limit = maxLimit
            }
        }
        if (p.limit !== undefined) {
            p.limit = numericToNumber(p.limit)
            if (maxLimit && (p.limit > maxLimit || p.limit < 0)) {
                p.limit = maxLimit
            }
            if (p.limit > 0) {
                this.limit(p.limit)
            }
            p.limit = undefined
        }

        if (p.offset !== undefined) {
            p.offset = numericToNumber(p.offset)
            if (p.offset > 0) this.offset(p.offset)
            p.offset = undefined
        }

        return this
    }

    SelectQueryBuilder.prototype.sort = function <T> (
        p: PaginatedSorted,
        defaultSort?: (c: SelectQueryBuilder<T>) => void,
        silentFail = false
    ): SelectQueryBuilder<T> {
        if (!p.sort) {
            if (defaultSort) {
                defaultSort(this)
            }

            return this
        }
        if (!this.expressionMap.mainAlias._metadata.target._columnsIndex) {
            this.expressionMap.mainAlias._metadata.target._columnsIndex = {}
            for (let col of this.expressionMap.mainAlias._metadata.columns) {
                // no sorting for json columns and arrays
                if (col.type === 'json'
                    || col.type === 'jsonb'
                    || (typeof col.type === 'string' && col.type.endsWith('[]'))
                ) {
                    continue
                }

                this.expressionMap.mainAlias._metadata.target._columnsIndex[col.databaseName] = true
            }
        }

        let items = p.sort.split(',')
        for (let field of items) {
            let order = 'ASC'
            if (field[0] === '-') {
                order = 'DESC'
                field = field.substr(1)
            }

            if (!(field in this.expressionMap.mainAlias._metadata.target._columnsIndex)) {
                if (silentFail) continue

                ApiError.e('UNKNOWN_FIELD', `Can't sort by '${field}' because there's no such field in related entity`)
            }

            this.addOrderBy(field, order)
        }

        return this
    }


    SelectQueryBuilder.prototype.getManyPaginated = function (): Promise<PaginatedResponse<any>> {
        return this.getManyAndCount().then(([items, count]) => ({ items, count }))
    }

    // calls strip() for attributes that should be hidden
    BaseEntity.prototype.stripHidden = function <T> (): BaseEntity {
        if (!this.constructor._hiddenColumns) {
            this.constructor._hiddenColumns = getConnection()
                .getMetadata(this.constructor).columns
                .filter(i => !i.isSelect)
                .map(i => i.databaseName)
        }
        return strip(this, this.constructor._hiddenColumns)
    }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module 'typeorm' {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    class SelectQueryBuilder<Entity> extends QueryBuilder<Entity> implements WhereExpression {
        addSelectHidden (): this

        paginate (paginated: Paginated, maxLimit?: number): this

        sort (sort: PaginatedSorted, defaultSort?: (c: SelectQueryBuilder<Entity>) => void, silentFail?: boolean): this

        getManyPaginated (): Promise<PaginatedResponse<Entity>>
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    class BaseEntity {
        stripHidden (): this
    }
}
