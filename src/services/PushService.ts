import IORedis from 'ioredis'
import { Notification } from '@/models/Notification'
import redis from '@/data/redis'
import { AnyKV } from '@/types'
import { merge } from '@/helpers/object-utils'
import fetch from 'node-fetch'
import { firebaseToken } from '@/config'
import { FirebaseToken } from '@/models/FirebaseToken'
import { FirebaseNotifierQueue } from '@/data/queues'
import { User } from '@/models/User'

export type PushEventListener = (
    data: NotificationMeta,
    notification: Notification | null
) => void

export interface NotificationMeta {
    /**
     * Update type: create/delete/update
     */
    u: 'C' | 'D' | 'U'

    /**
     * For u=U: new progress
     */
    p?: number

    /**
     * Notification topics
     */
    t: string[]

    /**
     * Notification ID(s) (in db) or actual notification (for real-time)
     */
    i: number | number[] | Partial<Notification>

    /**
     * Notification targets (user IDs)
     */
    k: number[]
}

export class PushService {
    static REDIS_CHANNEL = 'plashiki-pusher'
    private static __instance: PushService
    sub: IORedis.Redis
    private __registry: Record<string, PushEventListener[]> = {}

    private constructor () {
        this.sub = new IORedis()
        this.sub.subscribe(PushService.REDIS_CHANNEL)
            .then(() => {
                this.sub.on('message', (chan, msg) => {
                    if (chan === PushService.REDIS_CHANNEL) {
                        msg = JSON.parse(msg)
                        return this.__deliverNotification(msg)
                    }
                })
            })
    }

    public static get instance (): PushService {
        if (!PushService.__instance) {
            PushService.__instance = new PushService()
        }

        return PushService.__instance
    }

    private static async __spreadMeta (meta: NotificationMeta): Promise<void> {
        await redis.publish(PushService.REDIS_CHANNEL, JSON.stringify(meta))
    }

    register (userId: number, handler: PushEventListener): void {
        if (!this.__registry[userId]) {
            this.__registry[userId] = []
        }
        this.__registry[userId].push(handler)
    }

    unregister (userId: number, handler: PushEventListener): void {
        if (userId in this.__registry) {
            let i = this.__registry[userId].indexOf(handler)
            if (i > -1) {
                this.__registry[userId].splice(i, 1)
            }
        }
    }

    async sendNotification (notification: Notification, realTime = false): Promise<void> {
        if (!realTime) {
            notification = await notification.save()
        }
        let targets = notification.for_users ?? await User.findSubTargets(notification.topics)

        if (notification.payload.type === 'push' && targets.length && notification.topics.indexOf('no-fb') === -1) {
            FirebaseNotifierQueue.add('notify', {
                notificationId: notification.id,
                targets
            })
        }

        return PushService.__spreadMeta({
            u: 'C',
            p: notification.progress,
            i: realTime ? notification : notification.id,
            t: notification.topics,
            k: targets
        })
    }

    async getFullNotification (id: number): Promise<Notification | undefined> {
        return Notification.createQueryBuilder()
            .addSelectHidden()
            .where({
                id
            })
            .getOne()
    }

    async updateNotification (notification: number | Notification, progress: number, payload?: AnyKV): Promise<void> {
        if (typeof notification === 'number') {
            let res = await this.getFullNotification(notification)
            if (!res) {
                throw Error('Notification does not exist')
            }
            notification = res
        }

        notification.progress = progress
        if (payload) {
            if (!notification.payload) notification.payload = {}
            merge(notification.payload, payload)
        }
        await notification.save()

        let targets = notification.for_users ?? await User.findSubTargets(notification.topics)

        if (progress % 1 === 0 && notification.topics.indexOf('no-fb') === -1) {
            // no need in updating progress status in real-time with fcm.
            FirebaseNotifierQueue.add('notify', {
                notificationId: notification.id,
                targets
            })
        }

        return PushService.__spreadMeta({
            u: 'U',
            p: progress,
            i: notification.id,
            t: notification.topics,
            k: targets
        })
    }

    async deleteNotification (notification: number | Notification): Promise<void> {
        if (typeof notification === 'number') {
            let res = await Notification.findOne({
                id: notification
            })
            if (!res) {
                throw Error('Notification does not exist')
            }
            notification = res
        }

        notification.deleted = true
        await notification.save()

        let targets = notification.for_users ?? await User.findSubTargets(notification.topics)

        return PushService.__spreadMeta({
            u: 'D',
            i: notification.id,
            t: notification.topics,
            k: targets
        })
    }

    async deleteNotificationsWithTag (tag: string): Promise<void> {
        let all = await Notification.find({
            where: {
                tag
            },
            select: ['id', 'topics', 'for_users']
        })
        let targets = new Set<number>()
        let topicsCache: Record<string, number[]> = {}
        for (let notification of all) {
            let currentTargets: number[]
            if (notification.for_users) {
                currentTargets = notification.for_users
            } else {
                let topicsString = notification.topics.sort().join(';')
                if (topicsString in topicsCache) {
                    currentTargets = topicsCache[topicsString]
                } else {
                    currentTargets = topicsCache[topicsString] = await User.findSubTargets(notification.topics)
                }
            }
            currentTargets.forEach(it => targets.add(it))

            notification.deleted = true

            await notification.save()
        }

        return PushService.__spreadMeta({
            u: 'D',
            i: all.map(i => i.id),
            t: [],
            k: [...targets]
        })
    }

    deleteNotificationsWithTagDeferred (tag: string): void {
        FirebaseNotifierQueue.add('del-tag', {
            tag
        })
    }

    async getMissedNotifications (since: Date, topics: string[], userId: number): Promise<Notification[]> {
        return Notification.createQueryBuilder('notif')
            .where('time >= :since', { since })
            .andWhere('(topics && :topics OR :userId = any(for_users))', {
                topics,
                userId
            })
            .orderBy('notif.time', 'DESC')
            .getMany()
    }

    createNotification (notification: Partial<Notification>): Notification {
        return Notification.create(notification)
    }

    async checkFirebaseToken (token: string): Promise<boolean> {
        return fetch('https://iid.googleapis.com/iid/info/' + token, {
            headers: {
                Authorization: 'Bearer ' + firebaseToken
            }
        }).then(i => i.status === 200)
    }

    async addFirebaseToken (token: string, userId: number): Promise<void> {
        FirebaseToken
            .createQueryBuilder()
            .insert()
            .values({
                token,
                user_id: userId
            })
            .onConflict('(token) do nothing')
            .execute()
    }

    async removeFirebaseToken (token: string): Promise<void> {
        FirebaseToken
            .createQueryBuilder()
            .delete()
            .where({
                token
            })
            .execute()
    }

    private async __deliverNotification (msg: NotificationMeta): Promise<void> {
        const notification = typeof msg.i === 'number' ?
            await Notification.findOne({ id: msg.i }) :
            Array.isArray(msg.i) && msg.u === 'D' ? null :
            msg.i

        if (notification === undefined) {
            // weird flex, silently fail
            return
        }

        for (let target of msg.k) {
            if (target in this.__registry) {
                for (let listener of this.__registry[target]) {
                    listener(msg, notification as Notification | null)
                }
            }
        }
    }
}
