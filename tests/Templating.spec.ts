import { describe, it } from 'mocha'
import { expect } from 'chai'
import { defaults, templateFile } from '@/helpers/templating'
import { unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

describe('Templating', function () {
    const template = async (s: string, ctx = {}): Promise<string> => {
        // it's much easier than adding support for arbitrary strings.
        // anyway they are only used in tests.

        const filename = 'test.' + Math.random().toString(36).substr(2) + '.hbs'

        const full = join(defaults.lookup, filename)

        writeFileSync(full, s)
        const res = await templateFile(filename, ctx)
        unlinkSync(full)

        return res
    }

    it('should handle simple html files', async () => {
        expect(await template('<p>Hello world</p>')).to.eq('<p>Hello world</p>')
    })

    it('should handle simple interpolation', async () => {
        expect(await template('<p>Hello {{user}}</p>', {
            user: 'Bob'
        })).to.eq('<p>Hello Bob</p>')

        expect(await template('<p>Hello {{user}}</p>', {
            user: 'Bob < 1'
        })).to.eq('<p>Hello Bob &lt; 1</p>')
    })

    it('should handle html minification', async () => {
        expect(await template('<p id="user{{user}}">\n  Hello {{user}}\n</p>', {
            user: 'Bob'
        })).to.eq('<p id="userBob">Hello Bob </p>')
    })

    it('should handle css inlining', async () => {
        expect(await template('<style>p {color: white}</style>\n<p id="user{{user}}">\n  Hello {{user}}\n</p>', {
            user: 'Bob',
            $inlineCss: true
        })).to.eq('<p id="userBob" style="color:#fff">Hello Bob </p>')
    })
})
