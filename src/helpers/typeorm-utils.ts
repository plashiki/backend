import {
    BaseEntity,
    DefaultNamingStrategy,
    getConnection,
    NamingStrategyInterface,
    ObjectType,
    SelectQueryBuilder,
} from 'typeorm'
import { snakeCase } from 'typeorm/util/StringUtils'
import { strip } from './object-utils'
import { Paginated, PaginatedResponse, PaginatedSorted } from '@/types/api'
import { numericToNumber } from '@/types/utils'
import { ApiError } from '@/types/errors'

export class TheNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
    joinColumnName (relationName: string, referencedColumnName: string): string {
        return `${snakeCase(relationName)}_${referencedColumnName}`
    }
}

export class TheSelectQueryBuilder<T> extends SelectQueryBuilder<T> {
    // utility function to addSelect all hidden columns
    addSelectHidden (): this {
        if (!this.expressionMap.mainAlias) {
            throw new Error('Alias must be supplied for addSelectHidden')
        }
        if (!(
            this.expressionMap.mainAlias as any
        )._metadata.target._hiddenColumns) {
            (
                this.expressionMap.mainAlias as any
            )._metadata.target._hiddenColumns = (
                this.expressionMap.mainAlias as any
            )._metadata.columns
                .filter(i => !i.isSelect)
                .map(i => i.databaseName)
        }
        if (!(
            this.expressionMap.mainAlias as any
        )._metadata.target._hiddenColumnsAliased) {
            (
                this.expressionMap.mainAlias as any
            )._metadata.target._hiddenColumnsAliased = {}
        }
        if (!(
            this.expressionMap.mainAlias as any
        )._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name]) {
            (
                this.expressionMap.mainAlias as any
            )._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name] =
                (
                    this.expressionMap.mainAlias as any
                )._metadata.target._hiddenColumns.map(i => `${this.expressionMap.mainAlias!.name}.${i}`)
        }
        return this.addSelect(
            (
                this.expressionMap.mainAlias as any
            )._metadata.target._hiddenColumnsAliased[this.expressionMap.mainAlias.name],
        )
    }

    // utility function to paginate (e.g. add limit and offset) at the same time
    paginate (p: Paginated, maxLimit: number | null = null): this {
        if (maxLimit) {
            if (!p.limit || numericToNumber(p.limit) > maxLimit) {
                p.limit = maxLimit
            }
        }
        if (p.limit !== undefined) {
            p.limit = numericToNumber(p.limit)
            if (maxLimit && (
                p.limit > maxLimit || p.limit < 0
            )) {
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

    // shitty workaround for https://github.com/typeorm/typeorm/issues/296
    // it is actually very bad but idc lol
    // utility function to addSelect a column that does not exist in model
    addSelectAndMap (query: string, columnName: string, type: string): this {
        this.addSelect([`${query} as ${this.expressionMap.mainAlias!.name}_${columnName}`])
        const metadata = (this.expressionMap.mainAlias as any)._metadata
        if (!metadata.target._customMappedColumns) {
            metadata.target._customMappedColumns = {}
        }
        if (!(columnName in metadata.target._customMappedColumns)) {
            metadata.target._customMappedColumns[columnName] = true
            metadata.columns.push({
                ...metadata.columns[metadata.columns.length - 1],
                type,
                isSelect: false,
                propertyName: columnName,
                propertyPath: columnName,
                propertyAliasName: columnName,
                databaseName: columnName,
                databasePath: columnName,
                databaseNameWithoutPrefixes: columnName,
                setEntityValue (obj, value) {
                    obj[columnName] = value
                }
            })
        }

        return this
    }

    sort (
        p: PaginatedSorted,
        defaultSort?: (c: SelectQueryBuilder<T>) => void,
        silentFail = false,
    ): this {
        if (!p.sort) {
            if (defaultSort) {
                defaultSort(this)
            }

            return this
        }
        if (!(
            this.expressionMap.mainAlias as any
        )._metadata.target._columnsIndex) {
            (
                this.expressionMap.mainAlias as any
            )._metadata.target._columnsIndex = {}
            for (let col of (
                this.expressionMap.mainAlias as any
            )._metadata.columns) {
                // no sorting for json columns and arrays
                if (col.type === 'json'
                    || col.type === 'jsonb'
                    || (
                        typeof col.type === 'string' && col.type.endsWith('[]')
                    )
                ) {
                    continue
                }

                (
                    this.expressionMap.mainAlias as any
                )._metadata.target._columnsIndex[col.databaseName] = true
            }
        }

        let items = p.sort.split(',')
        for (let field of items) {
            let order = 'ASC'
            if (field[0] === '-') {
                order = 'DESC'
                field = field.substr(1)
            }

            if (!(
                field in (
                    this.expressionMap.mainAlias as any
                )._metadata.target._columnsIndex
            )) {
                if (silentFail) continue

                ApiError.e('UNKNOWN_FIELD', `Can't sort by '${field}' because there's no such field in related entity`)
            }

            this.addOrderBy(field, order as any)
        }

        return this
    }

    getManyPaginated (): Promise<PaginatedResponse<any>> {
        return this.getManyAndCount().then(([items, count]) => (
            { items, count }
        ))
    }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
export class TheEntity extends BaseEntity {
    static _hiddenColumns: string[]

    // calls strip() for attributes that should be hidden
    stripHidden (): this {
        if (!(
            this.constructor as any
        )._hiddenColumns) {
            (
                this.constructor as any
            )._hiddenColumns = getConnection()
                .getMetadata(this.constructor).columns
                .filter(i => !i.isSelect)
                .map(i => i.databaseName)
        }
        return strip(this,
            (
                this.constructor as any
            )._hiddenColumns,
        )
    }

    static createQueryBuilder <T extends TheEntity>(this: ObjectType<T>, alias: string): TheSelectQueryBuilder<T> {
        let connection = getConnection()
        if (alias) {
            const metadata = connection.getMetadata(this)
            return new TheSelectQueryBuilder(connection, (this as any).getRepository().queryRunner)
                .select(alias)
                .from(metadata.target, alias) as any

        } else {
            throw new Error('alias must be supplied for createQueryBuilder')
        }
    }
}
