<template>
    <div>
        <span class="checks-title">
            Checks:
        </span>
        <ul class="checks">
            <li
                :key="i"
                v-for="(ck, i) in checksText"
                v-html="ck"
            />
        </ul>
    </div>
</template>

<script>
export default {
    name: 'ChecksDisplay',
    props: ['checks'],
    computed: {
        checksText () {
            return this.checks.map((ck) => {
                if (ck.name === 'enum') {
                    return `One of: <code>${ck.params.values.join(', ')}</code>`
                }
                if (ck.name === 'numeric') {
                    let { min, max, int } = ck.params
                    let str = 'Numeric '
                    if (int) {
                        str += 'integer '
                    }
                    if (min !== undefined || max !== undefined) {
                        str += ` in range <b>[${min !== undefined ? min : '-∞'}; ${max !== undefined ? max : '∞'}]</b>`
                    }
                    return str
                }
                if (ck.name === 'count' || ck.name === 'length') {
                    let { min, max } = ck.params
                    if (min && max) {
                        return `Length is in range <b>[${min}, ${max}]</b>`
                    }
                    if (min) {
                        return 'Minimum length: ' + min
                    }
                    if (max) {
                        return 'Maximum length: ' + max
                    }
                    return 'Some count check' // idk
                }

                if (ck.name === 'url') {
                    let str = 'Valid URL'
                    if (ck.params && ck.params.protocols) {
                        str += `, protocol is one of: <code>${ck.params.protocols.join(', ')}</code>`
                    }
                    return str
                }

                if (ck.name === 'object') {
                    return (ck.params && ck.params.canBeArray) ? 'is an object or array' : 'Is an object'
                }
                console.warn('unknown check:', ck)

                return ck.name
            })
        },
    },
}
</script>

<style>
.checks-title {
    font-size: 14px;
    font-weight: bold;
}
</style>
