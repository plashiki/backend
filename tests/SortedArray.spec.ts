import { describe, it } from 'mocha'
import { expect } from 'chai'
import SortedArray from '@/helpers/sorted-array'

const rand = (a: number, b: number): number => a + Math.round(Math.random() * (b - a))

describe('SortedArray', function () {
    let s = new SortedArray<string>()

    it('should add items in a sorted-order', () => {
        // eslint-disable-next-line prefer-spread
        const randArr = Array.apply(null, { length: 10000 })
            .map(() => rand(-25e4, 25e4))
        s.insert(randArr)
        expect(s.raw).to.eql(randArr.sort((a, b) => a > b ? 1 : -1))
    })

    it('should check whether item is in array', () => {
        const i = rand(0, 9999)
        const it = s.raw[i]
        expect(s.index(it)).to.eq(i)
    })

    it('should work with custom comparators', () => {
        s = new SortedArray<string>(['apple', 'blueberry', 'cinema', 'dumpster', 'eagle'],
            (a, b) => a[0] === b[0] ? 0 : a[0] > b[0] ? 1 : -1)
        expect(s.find('a')).to.eq('apple')
        expect(s.find('anything')).to.eq('apple')
        expect(s.find('lorem')).to.eq(null)
        s.insert(['loop'])
        expect(s.find('lorem')).to.eq('loop')
    })
})
