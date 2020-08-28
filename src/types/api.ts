import { Expose } from 'class-transformer'
import { IsNumeric } from '@/helpers/validators'
import { IsOptional, IsString } from 'class-validator'
import { EntityConstructor } from '@/decorators/docs'
import { Numeric } from './utils'
import { ISession } from '@/middlewares/01_session'

export interface PaginatedResponse<T> {
    count: number
    items: T[]
}

export class Paginated {
    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    limit?: Numeric

    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    offset?: Numeric
}

@EntityConstructor({})
export class PaginatedSorted extends Paginated {
    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    limit?: Numeric

    @Expose()
    @IsNumeric({ min: 0 })
    @IsOptional()
    offset?: Numeric

    @Expose()
    @IsOptional()
    @IsString()
    sort?: string
}

declare module 'koa' {
    interface Context {
        session: ISession
        raw?: boolean
    }
}