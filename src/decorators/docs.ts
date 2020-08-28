// couldnt find good api docs engine -- wrote my own, xd

import { merge } from '@/helpers/object-utils'
import { AnyKV } from '@/types/utils'

export interface ParametrizedMeta {
    name: string
    params?: AnyKV
}

export interface EntityMeta {
    type: string
    extends?: string
    private?: boolean

    description?: string
    required?: boolean
    partial?: boolean
    default?: any
    checks?: ParametrizedMeta[]

    fields?: Record<string, EntityMeta>
}

export interface EndpointMeta {
    private?: boolean
    deprecated?: boolean

    name?: string
    description?: string
    method?: string
    path?: string | string[]
    checks?: ParametrizedMeta[]
    features?: ParametrizedMeta[]

    params?: Record<string, EntityMeta | string>
    query?: Record<string, EntityMeta | string>
    body?: EntityMeta

    returns?: EntityMeta
    throws?: EntityMeta[]

    children?: EndpointMeta[]
}


export const DocsKey = Symbol('desu-docs-meta')

export function getTypeString (type: any): string {
    if (type === Object) return 'object'
    if (type === String) return 'string'
    if (type === Number || type === 'float' || type === 'int') return 'number'
    if (type === Date) return 'Date'
    if (type === 'date') return 'Date'
    if (type === Boolean) return 'boolean'
    if (type === 'text') return 'string'
    if (type === 'json' || type === 'jsonb') return 'object'
    if (type === 'enum') return 'enum'
    if (type?.prototype) return type.prototype.name
    if (type === Array) return '' // type will be inferred later on

    console.warn('Unable to map type ' + type)

    return type as string
}

export function extendDocsMetadata (data: Partial<EndpointMeta>, obj: Function, key?: string): void {
    let old = key ? Reflect.getMetadata(DocsKey, obj, key) : Reflect.getMetadata(DocsKey, obj)
    let new_ = merge(old ?? {}, data)

    return key ? Reflect.defineMetadata(DocsKey, new_, obj, key) : Reflect.defineMetadata(DocsKey, new_, obj)
}

export function Endpoint (params: Partial<EndpointMeta>, then?: Function): Function {
    return (...args: [Function] | [object, string, PropertyDescriptor]): void => {
        if (process.env.DOCS_GENERATION === 'true') {
            if (args.length === 1) {
                const [target] = args
                extendDocsMetadata(params, target)
            } else {
                const [target, key] = args
                extendDocsMetadata(params, target.constructor, key)
            }
        }

        if (then) {
            then.apply(this, args)
        }
    }
}

export function EntityConstructor (params: Partial<EntityMeta>): ClassDecorator {
    return (constructor): void => {
        if (process.env.DOCS_GENERATION === 'true') {
            if (constructor.prototype && constructor.prototype !== Object && !params.extends) {
                params.extends = constructor.prototype.name
            }

            Reflect.defineMetadata(DocsKey, params, constructor)
        }
    }
}

export function EntityField (params: Partial<EntityMeta>): PropertyDecorator {
    return (target: object, propertyKey: string | symbol): void => {
        if (process.env.DOCS_GENERATION === 'true') {
            let type = Reflect.getMetadata('design:type', target, propertyKey)
            if (!params.type) params.type = getTypeString(type)
            Reflect.defineMetadata(DocsKey, params, target.constructor, propertyKey)
        }
    }
}
