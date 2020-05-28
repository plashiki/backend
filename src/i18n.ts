/* eslint-disable @typescript-eslint/no-use-before-define */
import { SupportedLanguage } from '@/config'
import { AnyKV } from '@/types'
import { TranslationKind, TranslationLanguage } from '@/models/Translation'


export const strings: Record<SupportedLanguage, Record<string, string | ((fmt?: AnyKV) => string)>> = {
    ru: {
        META_ensub: 'Английские субтитры',
        META_rusub: 'Русские субтитры',
        META_bysub: 'Белорусские субтитры',
        META_uasub: 'Украинские субтитры',
        META_jpsub: 'Японские субтитры',
        META_frsub: 'Французские субтитры',
        META_desub: 'Немецкие субтитры',
        META_cnsub: 'Китайские субтитры',
        META_kosub: 'Корейские субтитры',
        META_othersub: 'Субтитры на другом языке',
        META_endub: 'Английская озвучка',
        META_rudub: 'Русская озвучка',
        META_bydub: 'Белорусская озвучка',
        META_uadub: 'Украинская озвучка',
        META_jpdub: 'Японская озвучка',
        META_frdub: 'Французская озвучка',
        META_dedub: 'Немецкая озвучка',
        META_cndub: 'Китайская озвучка',
        META_kodub: 'Корейская озвучка',
        META_otherdub: 'Озвучка на другом языке',
        META_enraw: 'Оригинал на английском',
        META_ruraw: 'Оригинал на русском',
        META_byraw: 'Оригинал на белорусском',
        META_uaraw: 'Оригинал на украинском',
        META_jpraw: 'Оригинал на японском',
        META_frraw: 'Оригинал на французском',
        META_deraw: 'Оригинал на немецком',
        META_cnraw: 'Оригинал на китайском',
        META_koraw: 'Оригинал на корейском',
        META_otherraw: 'Оригинал на другом языке',

        NEW_TRANSLATION: 'Новый перевод',
        $meta (fmt: AnyKV): string {
            let meta = fmt.kind === TranslationKind.Subtitles ? 'с ' : 'в '
            let tran = $t('ru', 'META_' + fmt.lang + fmt.kind)
            if (fmt.kind === TranslationKind.Subtitles) {
                if (fmt.lang !== TranslationLanguage.Other) {
                    tran = tran.replace('ие ', 'ими ')
                }
                tran = tran.replace('титры', 'титрами')
            } else if (fmt.kind === TranslationKind.Dubbed) {
                if (fmt.lang !== TranslationLanguage.Other) {
                    tran = tran.replace('ая ', 'ой ')
                }
                tran = tran.replace('чка', 'чке')
            } else {
                tran = tran.replace('нал ', 'нале ')
            }
            meta += tran.toLowerCase()
            return meta
        },
        NEW_TRANSLATION_BODY (fmt: AnyKV): string {
            if (fmt.mediaType === 'anime') {
                // $episode серия «$animeName» $meta уже доступна!

                return `${fmt.part} серия «${fmt.name}» ${$t('ru', '$meta', fmt)} уже доступна!`
            }
            return 'НЕ ПОДДЕРЖИВАЕТСЯ, НАПИШИТЕ НАМ ОБ ОШИБКЕ 1'
        },
        MOD_NEW_TR: 'Новый перевод на модерации',
        MOD_NEW_TR_BODY (fmt: AnyKV): string {
            return `Перевод ${fmt.part} части «${fmt.name}» ${$t('ru', '$meta', fmt)}. Отправил ${fmt.sender}`
        },
        MOD_NEW_REP: 'Новая жалоба',
        MOD_NEW_REP_BODY: 'Жалоба на перевод №$id от $sender - $type'
    }
}

export function $t (lang: SupportedLanguage, field: string, fmt?: AnyKV): string {
    const str = strings[lang]?.[field]
    if (!str) {
        return field
    }

    if (str instanceof Function) return str(fmt)

    if (fmt) {
        return str.replace(/\$([a-zA-Z0-9]+)/g, (_, $1) => fmt[$1] ?? _)
    }

    return str
}
