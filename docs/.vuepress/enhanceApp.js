import spec from '../../spec.json'
import { slugify } from './util'

export default ({ siteData }) => {
    siteData.pages.forEach((page) => {
        if (page.regularPath === '/endpoints/') {
            if (!page.headers) {
                page.headers = []
            }
            spec.endpoints.forEach((ept) => {
                if (!ept.name) {
                    console.warn('no name:', ept)
                }

                page.headers.push({
                    title: ept.name,
                    slug: slugify(ept.name),
                    level: 2,
                })

                if (ept.children) {
                    ept.children.forEach((cept) => {
                        if (!cept.name) {
                            console.warn('no name:', cept)
                        }

                        page.headers.push({
                            title: cept.name,
                            slug: slugify(cept.name),
                            level: 3,
                        })
                    })
                }
            })
        }

        if (page.regularPath === '/entities/') {
            if (!page.headers) {
                page.headers = []
            }

            spec.entities.forEach((ent) => {
                if (!ent.type) {
                    console.warn('no name: ', ent)
                }

                page.headers.push({
                    title: ent.type,
                    slug: 'entity-' + slugify(ent.type),
                    level: 2,
                })
            })
        }
    })
}
