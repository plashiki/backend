import { Worker } from 'bullmq'
import { Translation } from '@/models/Translation'
import { Notification } from '@/models/Notification'
import { MediaType } from '@/types/media'

const worker = new Worker('TranslationNotifier', async ({ name, data }) => {
    if (name === 'notify-new') {
        const { translation } = data
        let in_part, same_meta
        if (!translation.in_part || !translation.same_meta) {
            let [result] = await Translation.query('select * from get_translation_count($1, $2, $3, $4, $5)',
                [translation.target_id, translation.target_type, translation.part, translation.kind, translation.lang]) as Record<string, string>[]
            ;({ in_part, same_meta } = result)
        } else {
            ({ in_part, same_meta } = translation)
        }
        if (in_part === '1' || same_meta === '1') {
            let topics: string[] = []

            if (in_part === '1') {
                topics.push(`tr:${translation.target_type}:${translation.target_id}`)
            }
            if (same_meta === '1') {
                topics.push(`tr:${translation.target_type}:${translation.target_id}:${translation.lang}:${translation.kind}`)
            }

            await Notification.create({
                topics,
                payload: {
                    type: 'push',
                    title: 'NEW_TRANSLATION',
                    body: 'NEW_TRANSLATION_BODY',
                    url: `$domain/${translation.target_type}/${translation.target_id}/${
                        translation.target_type === MediaType.anime ? 'episodes' : 'chapters'}/${translation.part}/translations/${translation.id}`,
                    format: {
                        id: translation.id,
                        mediaId: translation.target_id,
                        mediaType: translation.target_type,
                        part: translation.part,
                        kind: translation.kind,
                        lang: translation.lang,
                        author: translation.author
                    }
                } as any
            }).send()
        }
    }
})
worker.on('error', console.error)
