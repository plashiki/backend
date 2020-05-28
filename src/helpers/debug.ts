import _debug, { Debugger } from 'debug'
import { isProduction } from '@/config'

const _debugPrefix = 'api'
const _debuggers: Record<string, Debugger> = {}

if (!isProduction) {
    _debug.enable([...(process.env.DEBUG?.split(',') || []), _debugPrefix + ':*'].join(','))
}

export const getDebugger = function (name: string): Debugger {
    if (!(name in _debuggers)) {
        _debuggers[name] = _debug(`${_debugPrefix}:${name}`)
    }

    return _debuggers[name]
}

const debuggers = [
    'boot',
    'notify',
    'relations',
    'parsers',
    'telegram'
] as const
type DebuggerName = typeof debuggers[number]

export const DEBUG: Record<DebuggerName, Debugger> = {} as any

debuggers.forEach((it) => {
    Object.defineProperty(DEBUG, it, {
        value: getDebugger(it),
        writable: false
    })
})
