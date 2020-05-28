// eslint-disable-next-line no-undef
import CallSite = NodeJS.CallSite

export interface PrettyStacktrace {
    message?: string
    name?: string

    stack: {
        at: string
        pos: string
        file: string | null
    }[]
}

export default function prepareStackTrace (error: Error, stack: CallSite[]): PrettyStacktrace {
    const obj = {
        message: error.message,
        name: error.constructor.name,
        stack: stack.map(i => {
            let obj = {
                at: '',
                pos: `${i.getLineNumber()}:${i.getColumnNumber()}`,
                file: i.getFileName()
            }
            let type = i.getTypeName()
            let func = i.getFunctionName()
            let meth = i.getMethodName()
            if (i.isConstructor()) {
                obj.at = 'new ' + i.getFunctionName()
            } else {
                if (type && (func && func.split('.')[0] !== type || !func)) {
                    obj.at += type + '.'
                }
                if (func) {
                    obj.at += func
                } else {
                    obj.at += '<anonymous>'
                }

                if (meth && func !== meth) {
                    obj.at += ' [as ' + meth + ']'
                }
            }

            return obj
        })
    }

    obj.toString = (): string => `${obj.name}: ${obj.message}\n${obj.stack.map(i => `    at ${i.at} (${i.file}:${i.pos})`).join('\n')}`

    return obj
}

export function register (): void {
    Error.prepareStackTrace = prepareStackTrace
}
