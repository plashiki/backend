import { Worker } from 'bullmq'
import { sendTelegramMessageToMainChannel } from '@/external/telegram'
import { templateFile } from '@/helpers/templating'
import { UserService } from '@/services/UserService'

const userService = new UserService()

const worker = new Worker('TLogger', async ({ name, data }) => {
    if (name === 'delete') {
        const { reason, issuerId, translation } = data

        const issuer = await userService.getUserById(issuerId)

        return sendTelegramMessageToMainChannel(await templateFile('telegram/on-delete.hbs', {
            issuer,
            reason,
            translation
        }))
    }

    if (name === 'update') {
        const { reason, issuerId, translation, diff } = data

        const issuer = await userService.getUserById(issuerId)
        if ('url' in diff) {
            diff.urlDomain = new URL(diff.url).hostname
            translation.urlDomain = new URL(translation.url).hostname
        }

        return sendTelegramMessageToMainChannel(await templateFile('telegram/on-update.hbs', {
            issuer,
            reason,
            translation,
            diff
        }))
    }

    if (name === 'moder-new') {
        const { translation, issuerId } = data
        const issuer = await userService.getUserById(issuerId)

        return sendTelegramMessageToMainChannel(await templateFile('telegram/moder-new.hbs', {
            issuer,
            translation
        }))
    }

    if (name === 'rep-new') {
        const { report, issuerId } = data
        const issuer = await userService.getUserById(issuerId)

        return sendTelegramMessageToMainChannel(await templateFile('telegram/rep-new.hbs', {
            issuer,
            report
        }))
    }

    if (name === 'importers-run' || name === 'mappers-run' || name === 'cleaners-run') {
        try {
            await sendTelegramMessageToMainChannel(await templateFile(`telegram/${name}.hbs`, data))
        } catch (e) {
            console.error(e)
        }
    }
})
worker.on('error', console.error)
