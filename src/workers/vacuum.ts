import { Notification } from '@/models/Notification'
import { LessThan, Not } from 'typeorm'
import { Translation, TranslationStatus } from '@/models/Translation'
import { Report, ReportStatus } from '@/models/Report'
import { LOG } from '@/helpers/logging'

export async function vacuumDatabase (): Promise<void> {
    // delete deleted (lol) notifications after a week
    await Notification.delete({
        time: LessThan(new Date(Date.now() - 604800000)),
        deleted: true
    })

    // delete old notifications after 2 months (60 days)
    await Notification.delete({
        time: LessThan(new Date(Date.now() - 5184000000))
    })

    // delete declined translations after 2 weeks
    await Translation.delete({
        updated_at: LessThan(new Date(Date.now() - 1209600000)),
        status: TranslationStatus.Declined
    })

    // delete translations in Mapping state after a month (30 days)
    await Translation.delete({
        updated_at: LessThan(new Date(Date.now() - 2592000000)),
        status: TranslationStatus.Mapping
    })

    // delete processed reports after 2 weeks
    await Report.delete({
        updated_at: LessThan(new Date(Date.now() - 1209600000)),
        status: Not(ReportStatus.Pending)
    })

    LOG.workers.info('DB vacuumed!')
}
