import { Worker } from 'bullmq'
import { FirebaseToken } from '@/models/FirebaseToken'
import { In } from 'typeorm'
import { chunks, clone, groupBy, uniqueBy } from '@/helpers/object-utils'
import fetch from 'node-fetch'
import { firebaseToken, SupportedLanguage } from '@/config'
import { StatisticsQueue } from '@/data/queues'
import { PushService } from '@/services/PushService'
import { KeyValue } from '@/models/KeyValue'
import { Notification } from '@/models/Notification'
import { $t } from '@/i18n'
import ShikimoriApi from '@/external/shikimori/api'
import { DEBUG } from '@/helpers/debug'

const shikimoriApi = ShikimoriApi.instance

new Worker('FirebaseNotifier', async ({ name, data }) => {
    if (name === 'notify') {
        const { notificationId, targets } = data as {
            notificationId: number
            targets: number[]
        }
        if (!targets.length) return

        const notification = await PushService.instance.getFullNotification(notificationId)
        if (!notification) return
        let langs: Record<number, SupportedLanguage> = {
            // default fallback
            0: 'ru'
        }

        // pre-format notifications because service workers suck
        const translated: Partial<Record<SupportedLanguage, Notification>> = {}

        if (/* needTranslation */ notification.payload.type === 'push') {
            langs = {
                ...langs,
                ...(await KeyValue.getMany<SupportedLanguage>(
                    targets.map(i => `user:${i}:lang`), key => key.split(':')[1]
                ))
            }
            if (notification.payload.body === 'NEW_TRANSLATION_BODY' || notification.payload.body === 'MOD_NEW_TR_BODY') {
                const media = await shikimoriApi.getBriefMedia(
                    notification.payload.format.mediaType,
                    [notification.payload.format.mediaId]
                )
                notification.payload.image = `https://shikimori.one/system/${notification.payload.format.mediaType}s/original/${notification.payload.format.mediaId}.jpg`
                notification.payload.smallImage = `https://shikimori.one/system/${notification.payload.format.mediaType}s/preview/${notification.payload.format.mediaId}.jpg`

                if (media.length) {
                    uniqueBy(Object.values(langs)).forEach((lang) => {
                        const trd = clone(notification)
                        // big brain
                        trd.payload.format.name =
                            lang === 'ru'
                                ? media[0].russian || media[0].name
                                : media[0].name || media[0].russian

                        trd.payload.title = $t(lang, trd.payload.title, trd.payload.format)
                        trd.payload.body = $t(lang, trd.payload.body, trd.payload.format)
                        translated[lang] = trd
                    })
                }
            }
            if (notification.payload.body === 'MOD_NEW_REP_BODY') {
                uniqueBy(Object.values(langs)).forEach((lang) => {
                    const trd = clone(notification)

                    trd.payload.title = $t(lang, trd.payload.title, trd.payload.format)
                    trd.payload.body = $t(lang, trd.payload.body, trd.payload.format)
                    translated[lang] = trd
                })

            }

        }

        const tokens = await FirebaseToken.find({
            user_id: In(targets)
        })
        if (tokens.length === 0) return

        const cleanup: string[] = []
        const proms: Promise<any>[] = []
        const tokensLangs = groupBy(tokens, (token) => langs[token.user_id] ?? 'ru')

        const sent: FirebaseToken[] = []
        for (let [lang, toks] of Object.entries(tokensLangs)) {
            for (let part of chunks(toks, 1000)) {
                DEBUG.notify('Firebase sending to %d tokens', toks.length)
                proms.push(fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'POST',
                    body: JSON.stringify({
                        data: (translated[lang as any] ?? notification).payload,
                        registration_ids: part.map(i => i.token)
                    }),
                    headers: {
                        Authorization: 'Bearer ' + firebaseToken,
                        'Content-Type': 'application/json'
                    }
                }).then(i => i.json()).catch(console.error))
            }
            sent.push(...toks)
        }
        const results = await Promise.all(proms)
        let i = 0
        let sentCount = 0
        for (let res of results) {
            if (!res) continue
            if (res.failure > 0) {
                for (let q of res.results) {
                    if (q.error === 'InvalidRegistration') {
                        cleanup.push(sent[i].token)
                    }
                    i += 1
                }
            } else {
                i += res.success
            }
            sentCount += res.success
        }

        if (cleanup.length > 0) {
            DEBUG.notify('Removing %d dead tokens', cleanup.length)
            await FirebaseToken.delete({
                token: In(cleanup)
            })
        }

        StatisticsQueue.add('stat-event', {
            name: 'push',
            count: sentCount
        })
    }
})
