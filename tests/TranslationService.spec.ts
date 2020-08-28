import { describe, it } from 'mocha'
import { expect } from 'chai'
import { TranslationQueryResult } from '@/services/TranslationService.types'
import { Translation, TranslationKind, TranslationLanguage, TranslationStatus } from '@/models/Translation'
import { clone } from '@/helpers/object-utils'
import { TranslationService } from '@/services/TranslationService'
import { MediaType } from '@/types/media'

describe('TranslationService', () => {
    describe('#processTranslations', () => {
        const inst = new TranslationService()
        const func = inst.processTranslations.bind(inst)
        const base = [
            {
                id: 1,
                target_id: 1,
                target_type: MediaType.anime,
                part: 1,
                kind: TranslationKind.Subtitles,
                lang: TranslationLanguage.Russian,
                hq: true,
                author: 'FooSub',
                status: TranslationStatus.Added,
                url: 'https://example.com/1'
            },
            {
                id: 2,
                target_id: 1,
                target_type: MediaType.anime,
                part: 1,
                kind: TranslationKind.Dubbed,
                lang: TranslationLanguage.Russian,
                hq: true,
                author: 'FooDub',
                status: TranslationStatus.Added,
                url: 'https://example.com/2'
            },
            {
                id: 3,
                target_id: 1,
                target_type: MediaType.anime,
                part: 1,
                kind: TranslationKind.Original,
                lang: TranslationLanguage.Japanese,
                hq: true,
                author: 'FooRaw',
                status: TranslationStatus.Added,
                url: 'https://example.com/3'
            }
        ] as Translation[]
        const baseTarget = {
            '1': {
                'authors': [
                    {
                        'kind': 'sub',
                        'lang': 'ru',
                        'name': 'FooSub',
                        'translations': [
                            {
                                'hq': true,
                                'id': 1,
                                'name': 'example.com',
                                'uploader': 42,
                                'url': 'https://example.com/1'
                            }
                        ]
                    },
                    {
                        'kind': 'dub',
                        'lang': 'ru',
                        'name': 'FooDub',
                        'translations': [
                            {
                                'hq': true,
                                'id': 2,
                                'name': 'example.com',
                                'uploader': 42,
                                'url': 'https://example.com/2'
                            }
                        ]
                    },
                    {
                        'kind': 'raw',
                        'lang': 'jp',
                        'name': 'FooRaw',
                        'translations': [
                            {
                                'hq': true,
                                'id': 3,
                                'name': 'example.com',
                                'uploader': 42,
                                'url': 'https://example.com/3'
                            }
                        ]
                    }
                ],
                'players': [
                    'example.com'
                ]
            }
        } as TranslationQueryResult

        it('should work with empty arrays', () => {
            expect(func([])).to.eql({})
        })

        it('should work with single different meta inside same part', () => {
            expect(func(base)).to.eql(baseTarget)
        })

        it('should group same meta inside same part', () => {
            base[1].kind = TranslationKind.Subtitles
            base[1].author = 'FooSub'
            baseTarget[1].authors[0].translations.push(baseTarget[1].authors[1].translations[0])
            baseTarget[1].authors.splice(1, 1)
            expect(func(base)).to.eql(baseTarget)
        })

        it('should NOT group same meta inside different parts', () => {
            base[1].part = 2
            baseTarget[2] = {
                players: ['example.com'],
                authors: [
                    clone(baseTarget[1].authors[0])
                ]
            }
            baseTarget[2].authors[0].translations.shift()
            baseTarget[1].authors[0].translations.pop()
            expect(func(base)).to.eql(baseTarget)
        })

        it('should group same meta and similar authors inside same part', () => {
            base.push(clone(base[2]))
            base[3].author += ' yep'
            base[3].id++
            base[3].url += '?yep'

            base.push(clone(base[3]))
            base[4].author += ' x2'
            base[4].id++
            base[4].url += '&yepx2'

            let c = clone(baseTarget[1].authors[1].translations[0])
            c.id = base[3].id
            c.url = base[3].url
            baseTarget[1].authors[1].translations.push(c)

            c = clone(c)
            c.id = base[4].id
            c.url = base[4].url
            baseTarget[1].authors[1].translations.push(c)

            expect(func(base)).to.eql(baseTarget)
        })
    })
})
