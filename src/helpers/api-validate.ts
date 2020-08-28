import { validate, ValidationError, ValidatorOptions } from 'class-validator'
import { ClassTransformOptions, plainToClass } from 'class-transformer'
import { strip } from '@/helpers/object-utils'
import { BodyOptions } from 'routing-controllers'
import { AnyKV, Constructor } from '@/types/utils'
import { ApiValidationError } from '@/types/errors'

export interface TransformValidationOptions {
    validator?: ValidatorOptions
    transformer?: ClassTransformOptions
}


export const defaultValidatorOptions = {
    // empty here //
}

export function processErrors (errors: ValidationError[], prefix = ''): string[] {
    const ret: string[] = []
    errors.forEach((err) => {
        if (err.children) {
            ret.push(...processErrors(err.children, prefix ? prefix + '.' + err.property : err.property))
        }
        if (err.constraints) {
            ret.push(...Object.values(err.constraints))
        }
    })
    return ret.map(i => prefix ? `.${prefix}: ${i}` : i)
}

export default async function apiValidate<T> (
    constructor: Constructor<T>,
    pojo: AnyKV | AnyKV[],
    options?: TransformValidationOptions
): Promise<T> {
    strip(pojo, ['_'], true)

    const clazz = plainToClass(
        constructor,
        pojo,
        options?.transformer
    )

    const errors = await validate(clazz, Object.assign(options?.validator || {}, defaultValidatorOptions))
    if (errors.length > 0) {
        throw new ApiValidationError(processErrors(errors))
    }

    return clazz
}

export const PartialBody: BodyOptions = {
    validate: {
        skipMissingProperties: true
    }
}
