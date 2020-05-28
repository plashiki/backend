<!-- code is shit. -->
<template>
    <div class="endpoint">
        <component
            :id="slug"
            :is="'h' + level"
        >
            <a
                :href="'#' + slug"
                class="header-anchor"
                v-text="'#'"
            />
            {{ item.name }}
        </component>
        <template v-if="isAction">
            <div
                :class="isAction ? 'method-container method-' + item.method : ''"
                v-for="path in normalPaths"
            >
                <template v-if="isAction">
                    <span
                        :class="'method method-' + item.method"
                        v-text="item.method"
                    />
                    <div class="path-container">
                        <span
                            class="path"
                            v-html="path"
                        />
                    </div>
                </template>
            </div>
        </template>
        <p
            :class="isAction ? 'action-desc' :  'group-desc'"
            v-html="item.description"
        />
        <template v-if="item.features || item.checks">
            <h4>Special features:</h4>
            <ul class="features">
                <li
                    :key="i"
                    v-for="(feat, i) in features"
                    v-html="feat"
                />
            </ul>
        </template>

        <template v-if="item.params || item.body || item.query">
            <h4>Parameters</h4>

            <table class="params-table">
                <thead>
                <tr>
                    <td>Name</td>
                    <td>Type</td>
                    <td>Description</td>
                </tr>
                </thead>
                <tbody>

                <template v-if="item.params">
                    <tr class="params-table--group">
                        <td colspan="3">
                            URL parameters
                        </td>
                    </tr>
                    <tr v-for="(param, name) in item.params">
                        <td>:&#8288;{{ name }}</td>
                        <td>
                            <TypeDisplay :param="param" />
                        </td>
                        <td>
                            <span
                                v-html="param.description"
                            />
                            <ChecksDisplay
                                :checks="param.checks"
                                v-if="param.checks && param.checks.length"
                            />
                        </td>
                    </tr>
                </template>

                <template v-if="item.query">
                    <tr class="params-table--group">
                        <td colspan="3">
                            Query parameters
                        </td>
                    </tr>
                    <tr v-for="(param, name) in item.query">
                        <td>?&#8288;{{ name }}</td>
                        <td>
                            <TypeDisplay :param="param" />
                        </td>
                        <td>
                            <span
                                v-html="param.description"
                            />
                            <ChecksDisplay
                                :checks="param.checks"
                                v-if="param.checks && param.checks.length"
                            />
                        </td>
                    </tr>
                </template>

                <template v-if="item.body && item.body.fields">
                    <tr class="params-table--group">
                        <td colspan="3">
                            Body parameters (in JSON)
                        </td>
                    </tr>
                    <tr v-for="(param, name) in item.body.fields">
                        <td>{{ name }}</td>
                        <td>
                            <TypeDisplay :param="param" />
                        </td>
                        <td>
                            <span
                                v-html="param.description"
                            />
                            <ChecksDisplay
                                :checks="param.checks"
                                v-if="param.checks && param.checks.length"
                            />
                        </td>
                    </tr>
                </template>
                <tr
                    class="params-table--group"
                    v-else-if="item.body && item.body.type"
                >
                    <td colspan="3">
                        Body is
                        <TypeDisplay :param="item.body" mono />
                    </td>
                </tr>

                </tbody>
            </table>
        </template>

        <template v-if="item.returns">
            <h4>Returns</h4>
            <table
                class="params-table"
                v-if="item.returns.fields"
            >
                <thead>
                <tr>
                    <td>Name</td>
                    <td>Type</td>
                    <td>Description</td>
                </tr>
                </thead>
                <tbody>
                <tr class="params-table--group">
                    <td colspan="3">
                        Response parameters (in JSON)
                    </td>
                </tr>
                <tr v-for="(param, name) in item.returns.fields">
                    <td>{{ name }}</td>
                    <td>
                        <TypeDisplay :param="param" />
                    </td>
                    <td>
                            <span
                                v-html="param.description"
                            />
                        <ChecksDisplay
                            :checks="param.checks"
                            v-if="param.checks && param.checks.length"
                        />
                    </td>
                </tr>
                </tbody>
            </table>
            <TypeDisplay
                :param="item.returns"
                mono
                v-else
            />
            <p
                v-html="item.returns.description"
                v-if="item.returns.description"
            />
        </template>

        <template v-if="item.throws">
            <h4>Throws</h4>

            <table>
                <thead>
                <tr>
                    <td>
                        <div style="min-width:160px">Error</div>
                    </td>
                    <td>Description</td>
                </tr>
                </thead>
                <tbody>
                <tr
                    :key="i"
                    v-for="(it, i) in item.throws"
                >
                    <td>
                        <code>{{ it.type }}</code>
                    </td>
                    <td v-html="it.description" />
                </tr>
                </tbody>
            </table>
        </template>

        <template
            v-if="item.children && item.children.length > 0"
        >
            <div
                :key="i"
                v-for="(cept, i) in item.children"
            >
                <hr v-if="i !== 0" />
                <Endpoint
                    :item="cept"
                    :level="level + 1"
                />
            </div>
        </template>
    </div>
</template>

<script>
import ChecksDisplay from './ChecksDisplay'
import TypeDisplay from './TypeDisplay'
import { slugify } from '../util'

export default {
    name: 'Endpoint',
    components: { TypeDisplay, ChecksDisplay },
    props: {
        item: {
            type: Object,
            required: true,
        },
        level: {
            type: Number,
            default: 2,
        },
    },
    computed: {
        slug () {
            return slugify(this.item.name)
        },
        isAction () {
            return !this.item.children || this.item.children.length === 0
        },
        normalPaths () {
            if (!this.item.path) return [null]
            return typeof this.item.path === 'string' ? [this.item.path] : this.item.path
        },
        features () {
            if (!this.item.features && !this.item.checks) return []

            return [...(this.item.features || []), ...(this.item.checks || [])].map((it) => {
                if (it.name === 'captcha') {
                    return 'Captcha every ' + (it.params && it.params.timeout
                        ? (it.params.timeout / 1000) + ' seconds'
                        : 'time')
                }
                if (it.name === 'raw-response') {
                    return 'Raw (HTML) response'
                }
                if (it.name === 'alias') {
                    return `Alias at <code>${it.params.at}</code> — <code>${it.params.from}</code> → <code>${it.params.to}</code>`
                }
                if (it.name === 'login') {
                    return 'Requires auth' + (it.params && it.params.via ? (' via ' + it.params.via) : '')
                }
                if (it.name === 'logout') {
                    return 'Requires logout'
                }
                if (it.name === 'user-flag') {
                    return 'Requires <code>' + it.params.flag + ' = ' + it.params.value + '</code> on current user'
                }
                if (it.name === 'rate-limit') {
                    return 'Rate limiting at <b>' + it.params.requests + '</b> requests every <b>' + it.params.duration
                        + '</b> seconds'
                }
                if (it.name === 'current-user') {
                    return 'Only available for currently logged in user'
                }
                if (it.name === 'server-scope') {
                    return 'Requires server scope: <code>' + it.params.scope + '</code>'
                }
                console.warn('unknown feat', it)

                return it.name
            })
        },
    },
}
</script>
