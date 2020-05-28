import { describe, it } from 'mocha'
import { expect } from 'chai'

import { chunks, clone, isArray, isPojo, merge, shallowDiff } from '@/helpers/object-utils'

describe('object-utils.ts', () => {
    describe('isPojo', () => {
        it('should return true for pojos', () => {
            expect(isPojo({})).to.be.true
            expect(isPojo({
                a: 3,
                b: 4
            })).to.be.true
        })

        it('should return false for arrays', () => {
            expect(isPojo([])).to.be.false
            expect(isPojo([1, 2, 3])).to.be.false
        })

        it('should return false for class instances', () => {
            const Foo = class {
            }

            expect(isPojo(new Foo())).to.be.false
        })
    })

    describe('isArray', () => {
        it('should return true for arrays', () => {
            expect(isArray([])).to.be.true
            expect(isArray([1, 2, 3])).to.be.true
        })

        it('should return false for array-like objects', () => {
            expect(isArray(Buffer.from([1, 2, 3]))).to.be.false
        })

        it('should return false for iterators', () => {
            expect(isArray(chunks([1, 2, 3], 1))).to.be.false
        })

        it('should return false for non-iterables', () => {
            expect(isArray({})).to.be.false
            expect(isArray({
                1: 2,
                3: 4
            })).to.be.false
        })
    })

    describe('clone', () => {
        it('should do shallow copy for simple objects', () => {
            const foo = {
                a: 3,
                b: 4
            }
            const bar = clone(foo)

            bar.a += 5
            expect(bar.a).eq(8)
            expect(foo.a).eq(3)
        })

        it('should do a deep copy for nested objects', () => {
            const foo = {
                a: {
                    b: 3
                },
                c: 4,
                d: {
                    e: {
                        g: 7
                    }
                }
            }
            const bar = clone(foo)

            bar.a.b = 7
            bar.c = 9
            bar.d.e.g = 8

            expect(foo.a.b).eq(3)
            expect(foo.c).eq(4)
            expect(foo.d.e.g).eq(7)
        })
    })

    describe('merge', () => {
        it('should replace properties', () => {
            const foo = {
                a: 3,
                b: 4
            }

            merge(foo, {
                b: 5
            })

            expect(foo.a).eq(3)
            expect(foo.b).eq(5)
        })

        it('should add properties', () => {
            const foo = {
                a: 3,
                b: 4
            }

            const bar = merge(foo, {
                c: 45
            })

            expect(bar.c).eq(45)
        })

        it('should not replace nor add ignored properties', () => {
            const foo = {
                a: 3,
                b: 4
            }

            merge(foo, {
                a: 5,
                b: 6
            }, ['b'])

            expect(foo.a).eq(5)
            expect(foo.b).eq(4)
        })
    })

    it('shallowDiff', () => {
        const foo = {
            a: 3,
            b: 4
        }

        const bar = {
            a: 3,
            b: 5,
            c: 42
        }

        expect(shallowDiff(foo, bar)).to.eql({
            b: 5,
            c: 42
        })
    })
})
