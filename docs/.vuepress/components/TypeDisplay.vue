<template>
    <span
        :class="{ 'type-display--mono': mono }"
    >
        <span
            :key="i"
            v-for="({ type, array, paginated, partial }, i) in parts"
        >
            <span v-if="i !== 0">&#8288;|&#8203;&#8288;</span>
            <span
                v-if="!type || !type.length || type[0].toLowerCase() === type[0]"
            >
                {{ type }}
            </span>
            <template v-else>
                {{paginated ? 'PagiatedResponse<' : ''}}{{partial ? 'Partial<' : ''}}<router-link
                :to="$site.base + 'entities/#entity-' + slugify(type)"
                v-text="type"
            />{{partial ? '>' : ''}}{{array ? '[]' : ''}}{{paginated ? '>' : ''}}
            </template>
        </span>
    </span>
</template>

<script>
import { slugify } from '../util'

export default {
    name: 'TypeDisplay',
    props: {
        param: {
            type: Object,
        },
        mono: {
            type: Boolean,
            default: false,
        },
    },
    computed: {
        parts () {
            return this.param && this.param.type && this.param.type.split('|').map(i => {
                i = i.trim()

                let paginated = false
                let partial = false
                let m
                if ((m = i.match(/^PaginatedResponse<(.+)>$/))) {
                    paginated = true
                    i = m[1]
                }
                if ((m = i.match(/^Partial<(.+)>$/))) {
                    partial = true
                    i = m[1]
                }

                if (i.substr(i.length - 2) === '[]') {
                    return { type: i.substr(0, i.length - 2), array: true, paginated, partial }
                }
                return { type: i, paginated, partial }
            }) || []
        },
    },
    methods: {
        slugify,
    },
}
</script>

<style>
.type-display--mono {
    margin: 0 8px;
    font-family: monospace;
}
</style>
