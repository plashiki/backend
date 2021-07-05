import glob from 'glob'
import path from 'path'
import { LOG } from '@/helpers/logging'

const modulePath = Symbol('module-path')

export type LoadedModule<T> = T & {
    [modulePath]: string
}

export type LoadedDefaultModule<T, K> = LoadedModule<T> & {
    default: K
}

export default function directoryLoader<T, R = LoadedModule<T>> (folder: string, initializer: (mod: T, ...args: any[]) => any): () => Promise<R[]> {
    if (path.sep === '\\') {
        // fix for windows
        folder = folder.replace(/\\/g, '/')
    }
    return async (...args: any[]): Promise<R[]> => {
        LOG.boot.verbose('Bootstrapping %s', path.basename(folder))

        const ret: R[] = []

        const res = glob.sync(path.join(folder, '/**/*.{js,ts}'))
        LOG.boot.verbose(`Found %d modules.`, res.length)

        for (const mod of res) {
            let modPath: string | null = null

            if (mod.match(/[\\/]index\.[jt]s$/)) {
                const dir = path.dirname(mod)
                if (dir !== folder) {
                    modPath = dir
                } else {
                    continue
                }
            }

            if (modPath === null) {

                modPath = path.relative(folder, mod)
                modPath = modPath.substr(0, modPath.length - 3)
            }

            LOG.boot.debug(`  - ${modPath}...`)

            const imported = await import(mod)
            imported[modulePath] = modPath

            ret.push(await initializer(imported, ...args))
        }

        LOG.boot.info('Bootstrapping %s OK', path.basename(folder))

        return ret
    }
}
