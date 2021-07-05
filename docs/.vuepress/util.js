import { remove as removeDiacritics } from 'diacritics'

const rControl = /[\u0000-\u001f]/g
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’–—<>,.?/]+/g

// taken directly from vuepress source code.

export function slugify (str) {
    return removeDiacritics(str)
        // Remove control characters
        .replace(rControl, '')
        // Replace special characters
        .replace(rSpecial, '-')
        // Remove continuous separators
        .replace(/-{2,}/g, '-')
        // Remove prefixing and trailing separators
        .replace(/^-+|-+$/g, '')
        // ensure it doesn't start with a number (#121)
        .replace(/^(\d)/, '_$1')
        // lowercase
        .toLowerCase()
}
