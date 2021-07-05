import { readFile } from 'fs'
import { extname, join } from 'path'
import { compile, registerHelper, TemplateDelegate } from 'handlebars'
import { minify } from 'html-minifier'
import juice from 'juice'
import { AnyKV } from '@/types/utils'

const cache: Record<string, TemplateDelegate> = {}

registerHelper('eval', (string) => {
    return eval(string)
})

registerHelper('dump', (obj) => JSON.stringify(obj, null, 2))
registerHelper('eq', function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this)
})

registerHelper('neq', function (arg1, arg2, options) {
    return (arg1 != arg2) ? options.fn(this) : options.inverse(this)
})

export const defaults = {
    lookup: join(__dirname, '../templates')
}

export async function templateFile (file: string, context: AnyKV): Promise<string> {
    if (!(file in cache)) {
        const text = await new Promise<string>((resolve, reject) => {
            const fullFile = join(defaults.lookup, file)

            readFile(fullFile, async (err, data) => {
                if (err) {
                    return reject(err)
                }

                let str = data.toString()

                if (context.$inlineCss === true) {
                    str = juice(str, {
                        applyStyleTags: true,
                        removeStyleTags: true,
                        preserveMediaQueries: true,
                        preserveFontFaces: true,
                        preservePseudos: true,
                        applyHeightAttributes: true,
                        applyWidthAttributes: true,
                        applyAttributesTableElements: true
                    })
                }

                if (extname(file).match(/^\.(html|hbs)$/) || context.$minifyHtml === true) {
                    str = minify(str, {
                        minifyCSS: true,
                        minifyJS: true,
                        ignoreCustomFragments: [/{{[\s\S]*?}}/],
                        collapseBooleanAttributes: true,
                        removeComments: true,
                        removeScriptTypeAttributes: true,
                        removeStyleLinkTypeAttributes: true,
                        useShortDoctype: true,
                        collapseWhitespace: true,
                        html5: true
                    })

                }

                resolve(str)
            })
        })

        cache[file] = compile(text)
    }

    return cache[file](context)
}
