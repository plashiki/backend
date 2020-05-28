import { AnyKV } from '@/types'
import {
    registerDecorator,
    ValidationArguments,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface
} from 'class-validator'
import { isArray, isPojo } from '@/helpers/object-utils'

type IsNumericOptions = ValidationOptions & {
    min?: number
    max?: number
    int?: boolean
}


@ValidatorConstraint({ name: 'isNumeric', async: false })
class IsNumericConstraint implements ValidatorConstraintInterface {
    public validate (value: string | number, args?: ValidationArguments): boolean {
        const numericValue: number = typeof value === 'string' ? parseFloat(value) : value

        if (isNaN(numericValue)) {
            return false
        }

        const [min, max, int] = args?.constraints as number[]

        if (int && (numericValue % 1 !== 0)) {
            return false
        }

        return !(numericValue > max || numericValue < min)


    }

    public defaultMessage (args: ValidationArguments): string {
        const [min, max, int] = args.constraints as number[]

        return `$property must be a numeric${int ? ' integer' : ''} in range [${min}; ${max}]`
    }

}

export function IsNumeric (validationOptions?: IsNumericOptions) {
    return (object: AnyKV, propertyName: string): void => {
        registerDecorator({
            name: 'isNumeric',
            target: object.constructor,
            constraints: [
                validationOptions?.min ?? -Infinity,
                validationOptions?.max ?? Infinity,
                validationOptions?.int ?? true
            ],
            propertyName,
            options: validationOptions,
            validator: IsNumericConstraint
        })
    }
}

@ValidatorConstraint({ name: 'isPojo', async: false })
class IsPojoConstraint implements ValidatorConstraintInterface {
    validate (value: any, args?: ValidationArguments): boolean {
        const canBeArray = args?.constraints[0]

        if (!isPojo(value)) {
            return !!(canBeArray && isArray(value))

        }
        return true
    }
}

export function IsPojo (validationOptions?: IsNumericOptions & { canBeArray?: boolean }) {
    return (object: AnyKV, propertyName: string): void => {
        registerDecorator({
            name: 'isPojo',
            target: object.constructor,
            propertyName,
            constraints: [
                validationOptions?.canBeArray ?? false
            ],
            options: validationOptions,
            validator: IsPojoConstraint
        })
    }
}
