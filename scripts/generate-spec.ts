import { ValidationMetadata } from 'class-validator/metadata/ValidationMetadata'
import typeOrmLoader from '@/init/00_typeorm-loader'
import koaLoader from '@/init/02_koa-loader'
import { getMetadataArgsStorage } from 'routing-controllers'
import { getMetadataArgsStorage as getMetadataArgsStorageTypeorm } from 'typeorm'
import { getFromContainer, MetadataStorage } from 'class-validator'
import { createIndex, createMapIndex } from '@/helpers/object-utils'
import { ControllerMetadataArgs } from 'routing-controllers/metadata/args/ControllerMetadataArgs'
import { ActionMetadataArgs } from 'routing-controllers/metadata/args/ActionMetadataArgs'
import { ParamMetadataArgs } from 'routing-controllers/metadata/args/ParamMetadataArgs'
import { UseMetadataArgs } from 'routing-controllers/metadata/args/UseMetadataArgs'
import { DocsKey, EndpointMeta, EntityMeta, getTypeString, ParametrizedMeta } from '@/decorators/docs'
import { join } from 'path'
import * as fs from 'fs'
import { defaultMetadataStorage } from 'class-transformer/storage'
import { TypeMetadata } from 'class-transformer/metadata/TypeMetadata'
import { ExposeMetadata } from 'class-transformer/metadata/ExposeMetadata'

process.env.DOCS_GENERATION = 'true'

const SymArray = Symbol('SymArray')

type ExtendedActionMetadataArgs = ActionMetadataArgs & {
    params: ParamMetadataArgs[]
    uses: UseMetadataArgs[]
    meta: Partial<EndpointMeta>
}

type ExtendedControllerMetadataArgs = ControllerMetadataArgs & {
    actions: Record<string, ExtendedActionMetadataArgs[]>
    uses: UseMetadataArgs[]
    meta: Partial<EndpointMeta>
}

async function generate (): Promise<void> {
    const obj = {
        '//': 'This file is auto-generated, do not edit it!',
        endpoints: [] as EndpointMeta[],
        entities: [] as EntityMeta[]
    }


    console.log('[i] Loading controllers')
    await koaLoader(true)
    console.log('[i] Loading entities')
    await typeOrmLoader({
        url: 'invalid-host'
    }).catch(() => {
        //
    })
    // we only need entities to load

    console.log('[i] Preparing containers')
    const entStorage1 = getFromContainer(MetadataStorage)
    const entStorage2 = getMetadataArgsStorageTypeorm()
    const entStorage3 = defaultMetadataStorage as any
    const contStorage = getMetadataArgsStorage()

    console.log('[i] Processing entities')
    const entities: Map<Function, EntityMeta> = new Map<Function, EntityMeta>()
    entStorage2.tables.forEach((it) => {
        if (typeof it.target === 'function') {
            let meta = (Reflect.getMetadata(DocsKey, it.target) as EntityMeta) ?? {}
            if (meta.private) return

            entities.set(it.target, {
                type: it.target.name,
                ...meta as any
            })
        }
    })
    entStorage2.columns.forEach((col) => {
        if (typeof col.target === 'function') {
            let entity = entities.get(col.target)
            let conMeta = Reflect.getMetadata(DocsKey, col.target) ?? {}
            if (conMeta.private) return

            if (!entity) {
                entities.set(col.target, {
                    type: col.target.name,
                    ...conMeta
                })
                entity = entities.get(col.target)!
            }
            if (!entity.fields) {
                entity.fields = {}
            }

            let meta = (Reflect.getMetadata(DocsKey, col.target, col.propertyName) as EntityMeta) ?? {}
            if (meta.private) return
            if (!meta.type && !col.options.type) return

            let type = meta.type || getTypeString(col.options.type!)

            if (!meta.type && col.options.array) {
                type = type.includes(' ') ? `(${type})[]` : type + '[]'
            }

            if (!meta.type && col.options.nullable) {
                type += ' | null'
            }

            if (type) {
                entity.fields[col.propertyName] = {
                    type,
                    ...meta as any
                }
            }
        }
    })
    entStorage2.relations.forEach((rel) => {
        if (typeof rel.target === 'function' && typeof rel.type === 'function') {
            let meta = (Reflect.getMetadata(DocsKey, rel.target, rel.propertyName) as EntityMeta) ?? {}
            if (meta.private) return

            let entity = entities.get(rel.target)
            let conMeta = Reflect.getMetadata(DocsKey, rel.target) ?? {}
            if (conMeta.private) return

            if (!entity) {
                entities.set(rel.target, {
                    type: rel.target.name,
                    ...conMeta
                })
                entity = entities.get(rel.target)!
            }

            let type = rel.type.prototype ? rel.type() : rel.type
            if (!entity.fields) {
                entity.fields = {}
            }

            entity.fields![rel.propertyName] = {
                type,
                ...meta as any
            }
        }
    });

    ((entStorage1 as any).validationMetadatas as ValidationMetadata[]).forEach((vmd) => {
        if (typeof vmd.target === 'function') {
            let meta = (Reflect.getMetadata(DocsKey, vmd.target, vmd.propertyName) as EntityMeta) ?? {}
            if (meta.private) return

            let entity = entities.get(vmd.target)
            if (!entity) {
                entities.set(vmd.target, {
                    type: vmd.target.name
                })
                entity = entities.get(vmd.target)!
            }
            if (!entity.fields) {
                entity.fields = {}
            }


            if (!entity.fields[vmd.propertyName]) {
                entity.fields[vmd.propertyName] = meta
            }

            if (vmd.type === 'conditionalValidation') return

            let check: ParametrizedMeta | null = null
            let type: string | null = null

            if (vmd.type === 'customValidation' && vmd.constraintCls.name === 'IsNumericConstraint') {
                type = 'number | string'
                let params: any = {}

                let [min, max, int] = vmd.constraints

                if (min !== -Infinity) {
                    params.min = min
                }

                if (max !== Infinity) {
                    params.max = max
                }

                params.int = int

                check = {
                    name: 'numeric',
                    params
                }
            }

            if (vmd.type === 'customValidation' && vmd.constraintCls.name === 'IsPojoConstraint') {
                let [canBeArray] = vmd.constraints

                check = {
                    name: 'object',
                    params: {
                        canBeArray
                    }
                }
            }

            if (vmd.type === 'isUrl') {
                type = 'string'
                check = {
                    name: 'url',
                    params: vmd.constraints[0]
                }
            }

            if (vmd.type === 'isEnum') {
                check = {
                    name: 'enum',
                    params: {
                        values: Object.values(vmd.constraints[0])
                    }
                }
            }

            if (vmd.type === 'isIn') {
                check = {
                    name: 'enum',
                    params: {
                        values: vmd.constraints[0]
                    }
                }
            }

            if (vmd.type === 'maxLength') {
                check = {
                    name: 'length',
                    params: {
                        max: vmd.constraints[0]
                    }
                }
            }

            if (vmd.type === 'isString') {
                type = 'string'
                if (vmd.each) {
                    type += '[]'
                }
            }

            if (vmd.type === 'isBoolean') {
                type = 'boolean'
                if (vmd.each) {
                    type += '[]'
                }
            }

            if (vmd.type === 'isNumber') {
                type = 'number'
                if (vmd.each) {
                    type += '[]'
                }
            }
            if (vmd.type === 'isArray') {
                if (type) {
                    type += '[]'
                } else {
                    entity.fields[vmd.propertyName][SymArray] = true
                }
            }

            if (check !== null) {
                if (!entity.fields[vmd.propertyName].checks) {
                    entity.fields[vmd.propertyName].checks = []
                }
                entity.fields[vmd.propertyName].checks!.push(check)
            }

            if (type !== null && !entity.fields[vmd.propertyName].type) {
                entity.fields[vmd.propertyName].type = type
            }
        }
    })
    for (let [con, v] of (entStorage3._typeMetadatas as Map<Function, Map<string, TypeMetadata>>).entries()) {
        let entity = entities.get(con)
        let meta = Reflect.getMetadata(DocsKey, con) ?? {}
        if (meta.private) continue

        if (!entity) {
            entities.set(con, {
                type: con.name,
                ...meta
            })
            entity = entities.get(con)!
        }

        for (let [prop, tmd] of v.entries()) {
            let meta = Reflect.getMetadata(DocsKey, con, prop) ?? {}
            if (meta.private) continue
            if (!entity.fields) {
                entity.fields = {}
            }
            if (!entity.fields[prop]) {
                entity.fields[prop] = meta
            }
            entity.fields[prop].type = tmd.typeFunction().name
            if (entity.fields[prop][SymArray]) {
                entity.fields[prop].type += '[]'
            }

        }
    }
    for (let [con, v] of (entStorage3._exposeMetadatas as Map<Function, Map<string, ExposeMetadata>>).entries()) {
        let meta = Reflect.getMetadata(DocsKey, con) ?? {}
        if (meta.private) continue

        let entity = entities.get(con)
        if (!entity) {
            entities.set(con, {
                type: con.name,
                ...meta
            })
            entity = entities.get(con)!
        }

        for (let [prop,] of v.entries()) {
            let meta = Reflect.getMetadata(DocsKey, con, prop) ?? {}
            if (meta.private) continue
            if (!entity.fields) {
                entity.fields = {}
            }
            if (!entity.fields[prop]) {
                entity.fields[prop] = meta
            }
            if (!entity.fields[prop].type) {
                entity.fields[prop].type = 'object'
            }
        }
    }

    obj.entities = [...entities.values()]

    let entitiesIndex = createIndex(obj.entities, i => i.type)

    console.log('[i] Processing controllers')
    let eControllers = contStorage.controllers.map((it): ExtendedControllerMetadataArgs => ({
        ...it,
        actions: {},
        uses: [],
        meta: Reflect.getMetadata(DocsKey, it.target)
    }))
    let controllers = createMapIndex(eControllers, i => i.target) as Map<Function, ExtendedControllerMetadataArgs>

    let actions: Map<Function, Map<string, ExtendedActionMetadataArgs[]>> = new Map<Function, Map<string, ExtendedActionMetadataArgs[]>>()

    contStorage.actions.forEach((it) => {
        let eit: ExtendedActionMetadataArgs = {
            ...it,
            params: [],
            uses: [],
            meta: Reflect.getMetadata(DocsKey, it.target, it.method) ?? {}
        }

        if (!actions.get(it.target)) {
            actions.set(it.target, new Map<string, ExtendedActionMetadataArgs[]>())
        }

        if (!actions.get(it.target)!.get(it.method)) {
            actions.get(it.target)!.set(it.method, [])
        }
        actions.get(it.target)!.get(it.method)!.push(eit)
        if (!controllers.get(it.target)!.actions[it.method]) {
            controllers.get(it.target)!.actions[it.method] = []
        }
        controllers.get(it.target)!.actions[it.method].push(eit)

        if (eit.meta.params?.$extends !== undefined) {
            let ext = entitiesIndex[eit.meta.params.$extends as string]
            if (!ext || !ext.fields) {
                console.warn(`Failed to $extend ${eit.meta.params.$extends} at ${it.target.name}#${it.method}:params`)
            } else {
                eit.meta.params = {
                    ...ext.fields,
                    ...eit.meta.params
                } as any
            }
            delete eit.meta.params!.$extends
        }

        if (eit.meta.query?.$extends !== undefined) {
            let ext = entitiesIndex[eit.meta.query.$extends as string]
            if (!ext || !ext.fields) {
                console.warn(`Failed to $extend ${eit.meta.query.$extends} at ${it.target.name}#${it.method}:query`)
            } else {
                eit.meta.query = {
                    ...ext.fields,
                    ...eit.meta.query
                } as any
            }
            delete eit.meta.query!.$extends
        }
    })

    contStorage.params.forEach((it) => {
        if (!actions.get(it.object.constructor)) {
            actions.set(it.object.constructor, new Map<string, ExtendedActionMetadataArgs[]>())
        }
        actions.get(it.object.constructor)!.get(it.method)?.forEach(i => i.params[it.index] = it)
    })

    contStorage.uses.forEach((it) => {
        if (it.method === undefined) {
            controllers.get(it.target)?.uses.push(it)
        } else {
            actions.get(it.target)?.get(it.method)?.forEach(i => i.uses.push(it))
        }
    })

    eControllers.forEach((ctr) => {
        let ept: EndpointMeta = {
            ...(ctr.meta || {}),
            children: []
        }
        if (ept.private) return

        Object.values(ctr.actions).forEach((acts) => {
            let cept: EndpointMeta | null = null

            acts.forEach((act) => {
                let path = '/'
                if (act.route) {
                    if (typeof act.route === 'string') {
                        path = act.route.replace(/\/(:[a-zA-Z0-9]+)\((?:(?<!\\\)).)*?\)/g, (_, $1) => '/' + $1)
                    } else path = act.route.source
                }
                path = join(ctr.route || '', path)
                    // fix for windows lol
                    .replace(/\\/g, '/')

                if (!cept) {
                    cept = {
                        method: act.type.toUpperCase(),
                        path,
                        ...(act.meta || {})
                    }
                } else {
                    if (typeof cept.path === 'string') {
                        cept.path = [cept.path]
                    }
                    (cept.path as string[]).push(path)
                }
            })

            if (cept!.private) return
            ept.children!.push(cept!)
        })

        obj.endpoints.push(ept)
    })
    console.log('[i] Writing to file')

    let dir = __dirname
    let idx = dir.lastIndexOf('dist')
    if (idx > -1) {
        dir = dir.substr(0, idx) + dir.substr(idx + 4)
    }

    await fs.promises.writeFile(join(dir, '../spec.json'), JSON.stringify(obj, null, 4))
    console.log('[v] Done!')
}

if (require.main === module) {
    generate().catch(console.error).then(() => process.exit())
}
