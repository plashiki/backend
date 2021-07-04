<template>
    <div>
        <div class="text-center">
            <img
                class="app-icon"
                src="/img/icons/primary.svg"
            />
            <h2>PlaShiki</h2>
        </div>

        <v-simple-table>
            <tbody>
                <tr>
                    <td>{{ $t('Pages.Settings.Version') }}</td>
                    <td>{{ version }}</td>
                </tr>
                <tr>
                    <td>{{ $t('Pages.Settings.BuiltOnCommit') }}</td>
                    <td>
                        <a
                            :href="'//github.com/plashiki/frontend/commit/' + currentCommit"
                            target="_blank"
                            v-text="currentCommit"
                        />
                    </td>
                </tr>
                <tr>
                    <td>{{ $t('Pages.Settings.BuildDate') }}</td>
                    <td>{{ buildDate }}</td>
                </tr>
                <tr>
                    <td>{{ $t('Pages.Settings.License') }}</td>
                    <td>(A)GPLv3</td>
                </tr>
            </tbody>
        </v-simple-table>

        <a
            class="mt-2 caption"
            href="/tos"
            target="_blank"
            v-text="$t('Pages.Tos.Name')"
        />
        /
        <a
            class="mt-2 caption"
            href="/legal"
            target="_blank"
            v-text="$t('Pages.Legal.Name')"
        />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { buildDate, currentCommit, version } from '@/config'

@Component({})
export default class AboutTab extends Vue {
    buildDate = buildDate
    currentCommit = currentCommit
    version = version
}
</script>

<style>
.app-icon {
    width: 96px;
    height: 96px;
}
</style>
