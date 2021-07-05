import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator'
import { AnyKV } from '@/types/utils'

export type ValidationFunction = (obj: any, args: ValidationArguments) => boolean | Promise<boolean>

export function SimpleValidator (validate: ValidationFunction, isAsync?: boolean, validationOptions?: ValidationOptions) {
    return function (object: AnyKV, propertyName: string): void {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            async: isAsync,
            validator: {
                validate
            }
        })
    }
}

export function createSimpleValidator (validator: ValidationFunction, isAsync?: boolean) {
    return function (validationOptions?: ValidationOptions): Function {
        return SimpleValidator(validator, isAsync, validationOptions)
    }
}
