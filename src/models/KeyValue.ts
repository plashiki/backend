// distributed, cheaper, slower and not in-memory redis replacement
// idc honestly, i dont want to store all the shit like TIME OF LAST SYNC WITH SOME SERVICE FOR GUY XXX
// in memory all the time but still want to have that data somewhere outside main User model.

import { BaseEntity, Column, Entity, In, PrimaryColumn } from 'typeorm'
import { EntityConstructor } from '@/decorators/docs'
import { AnyKV } from '@/types/utils'

@EntityConstructor({
    private: true
})
@Entity()
export class KeyValue extends BaseEntity {
    @PrimaryColumn()
    key: string

    @Column()
    value: string

    static get<T> (key: string, fallback: T | null = null): Promise<T> {
        return KeyValue.findOne({ key })
            .then(it => {
                if (!it) return fallback
                return JSON.parse(it.value)
            })
    }

    static getMany<T> (keys: string[], transformKey?: (k: string) => string): Promise<Record<string, T>> {
        if (!keys.length) return Promise.resolve({})
        return KeyValue.find({
            key: In(keys)
        }).then((items) => {
            let ret = {}
            items.forEach(({ key, value }) => {
                ret[transformKey ? transformKey(key) : key] = JSON.parse(value)
            })

            return ret as any
        })
    }

    static async set<T> (key: string, value: T): Promise<void> {
        let str = JSON.stringify(value) ?? 'null'
        await this.query('insert into "key_value" (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value',
            [key, str])
    }

    static async setMany (items: AnyKV): Promise<void> {
        // maybe in one query somehow?..
        await Promise.all(Object.entries(items).map(([k, v]) => this.set(k, v)))
    }

    static async del (key: string): Promise<void> {
        await KeyValue.delete({ key })
    }
}
