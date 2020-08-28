import { IsNumeric } from '@/helpers/validators'
import { IsEnum, IsOptional } from 'class-validator'
import { Expose } from 'class-transformer'
import { EntityConstructor } from '@/decorators/docs'
import { Paginated } from '@/types/api'
import { MediaType, UserRateStatus } from '@/types/media'

@EntityConstructor({
    description: 'Paramters for Get user rates request'
})
export class GetUserRatesParams extends Paginated {
    // vvv only for input validation. in delegates in may be a string as well
    @Expose()
    @IsNumeric()
    @IsOptional()
    user_id: string | number

    @IsNumeric()
    @Expose()
    @IsOptional()
    target_id?: number

    @IsEnum(MediaType)
    @Expose()
    @IsOptional()
    target_type?: MediaType

    @IsEnum(UserRateStatus)
    @Expose()
    @IsOptional()
    status?: UserRateStatus
}
