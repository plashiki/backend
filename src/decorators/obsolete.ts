import { ObsoleteError } from '@/types'

export default function Obsolete (reason?: string): MethodDecorator {
    return (target: object, method: string, descriptor: PropertyDescriptor): void => {
        descriptor.value = (): never => {
            ObsoleteError.e(reason ?? 'unknown')
        }
    }
}
