export default class Mutex {
    private __promise?: Promise<any>
    private __unlock?: Function

    static synchronized<F extends Function> (func: F, thisArg: any, mutex?: Mutex): F {
        let _mutex = mutex ?? new Mutex()

        return async function (...args) {
            await _mutex.acquire()
            let ret
            try {
                ret = await func.apply(thisArg, args)
            } catch (e) {
                _mutex.release()
                throw e
            }
            _mutex.release()
            return ret
        } as any
    }

    async acquire (): Promise<void> {
        if (this.__promise) {
            await this.__promise
        }
        this.__promise = new Promise(resolve => {
            this.__unlock = resolve
        })
    }

    release (): void {
        if (!this.__unlock) return
        this.__unlock()
        this.__promise = undefined
        this.__unlock = undefined
    }
}
