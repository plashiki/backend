// Based on https://gist.github.com/teidesu/537c14805634fbfcd42ae48da45307f1

type Event = Promise<void> & { emit: () => void }
export type AsyncPoolYieldItem<T, V> = {
    idx: number
    item: T
    value?: V
    error?: Error
}

function event (): Event {
    let emit: () => void
    let prom = new Promise((resolve) => {
        emit = resolve
    }) as Event
    prom.emit = emit!
    return prom
}

export function asyncPool<T, V> (
    callback: (idx: number, item: T) => V,
    iterable: Iterable<T> | AsyncIterable<T>,
    limit = 5
): AsyncIterable<AsyncPoolYieldItem<T, V>> {
    if (limit <= 0) throw new Error('Pool limit must be a positive number')

    const iteratorFactory = iterable[Symbol.iterator] || iterable[Symbol.asyncIterator]
    if (!iteratorFactory) throw new Error('`iterable` must me iterable!')
    const iterator = iteratorFactory.call(iterable)

    let idx = 0
    let iteratorNext: IteratorResult<T> | null = null
    let working = 0
    let buffer: AsyncPoolYieldItem<T, V>[] = []
    let bufferHasItems = event()

    function startNext () {
        let currentIdx = idx++
        const it = iteratorNext!.value
        let prom = Promise.resolve(callback(idx, it))
        working += 1
        prom.then((res) => {
            buffer.push({ idx: currentIdx, item: it, value: res })
        }).catch((err) => {
            buffer.push({ idx: currentIdx, item: it, error: err })
        }).finally(() => {
            working -= 1
            bufferHasItems.emit()
        })
    }

    async function next (): Promise<IteratorResult<AsyncPoolYieldItem<T, V>>> {
        if (buffer.length) return { done: false, value: buffer.shift()! }
        if (working === 0 && iteratorNext && iteratorNext.done) return { done: true, value: undefined }

        while (working !== limit && (!iteratorNext || !iteratorNext.done)) {
            iteratorNext = await iterator.next()
            if (!iteratorNext!.done) {
                startNext()
            }
        }
        await bufferHasItems
        bufferHasItems = event()
        return { done: false, value: buffer.shift()! }
    }

    return {
        [Symbol.asyncIterator]: () => ({ next })
    }
}
