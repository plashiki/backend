import { describe, it } from 'mocha'
import { expect } from 'chai'

import ShikimoriApi from '../src/external/shikimori/api'

describe('ShikimoriApi', () => {
    const api = ShikimoriApi.instance

    describe('getUser', () => {
        it('should work with ids', async () => {
            const user = await api.getUser(1)

            if (!user) return

            expect(user.id).to.eq(1)
            expect(user.nickname).to.eq('morr')
        })

        it('should work with nicknames', async () => {
            const user = await api.getUser('morr')

            if (!user) return

            expect(user.id).to.eq(1)
            expect(user.nickname).to.eq('morr')
        })

        it('should return null for non-existent', async () => {
            const user = await api.getUser(Date.now().toString(36) + Math.random().toString(36))

            expect(user).to.eq(null)
        })
    })
})
