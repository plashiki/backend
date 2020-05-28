import { TransformOperationExecutor } from 'class-transformer/TransformOperationExecutor'
import { TypeMetadata } from 'class-transformer/metadata/TypeMetadata'

// See https://github.com/typestack/routing-controllers/issues/518
// and https://github.com/typestack/class-validator/issues/438

export default function fixValidation (): void {
    const original = JSON.parse
    JSON.parse = function (obj, reviver): any {
        return original.call(this, obj, (key, value) => {
            if (key === '__proto__') {
                return undefined
            }
            if (reviver) {
                return reviver(key, value)
            }
            return value
        })
    }

    // also some random meme: plain objects (targetType === Object) do not get any fields
    // when excludeExtraneousValues is true.
    let func = TransformOperationExecutor.prototype.transform

    // eslint-disable-next-line @typescript-eslint/ban-types
    TransformOperationExecutor.prototype.transform = function (source: Object | Object[] | any, value: Object | Object[] | any, targetType: Function | TypeMetadata, arrayType: Function, isMap: boolean, level?: number): any {
        if (targetType === Object && typeof value === 'object' && value !== null) return value

        return func.call(this, source, value, targetType, arrayType, isMap, level)
    }
}
