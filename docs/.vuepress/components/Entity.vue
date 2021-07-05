<template>
    <div class="entity">
        <h2 :id="slug">
            <a
                :href="'#' + slug"
                class="header-anchor"
                v-text="'#'"
            />
            {{ item.type }}
        </h2>

        <p v-html="item.description" />

        <h4>Fields</h4>

        <table class="params-table">
            <thead>
            <tr>
                <td>Name</td>
                <td>Type</td>
                <td>Description</td>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(param, name) in item.fields">
                <td>{{ name }}</td>
                <td>
                    <TypeDisplay :param="param" />
                </td>
                <td>
                    <span v-html="param.description" />
                    <ChecksDisplay
                        :checks="param.checks"
                        v-if="param.checks && param.checks.length"
                    />
                </td>
            </tr>
            </tbody>
        </table>

    </div>
</template>

<script>
import { slugify } from '../util'
import ChecksDisplay from './ChecksDisplay'
import TypeDisplay from './TypeDisplay'

export default {
    name: 'Entity',
    components: { TypeDisplay, ChecksDisplay },
    props: {
        item: {
            type: Object,
            required: true,
        },
    },
    computed: {
        slug () {
            return 'entity-' + slugify(this.item.type)
        },
    },
}
</script>
