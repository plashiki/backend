import IORedis from 'ioredis'

const redis = new IORedis()

export default redis

export async function simpleMget (keys: (string | number)[], prefix: string): Promise<Record<string, string | number>> {
    let ret = {}

    const result = await redis.mget(...keys.map(i => prefix + i))
    result.forEach((value, i) => {
        ret[keys[i]] = value
    })

    return ret as any
}
