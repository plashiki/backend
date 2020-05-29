import { config } from 'dotenv'
import { StringKV } from '@/types'

config()

const env: StringKV = process.env as any

export const appName = 'PlaShiki'
export const isProduction: boolean = env.NODE_ENV === 'production'
export const database: string = env.DATABASE
export const databaseType: string = env.DATABASE_TYPE
export const vk: string = env.VK_TOKEN
export const session: string = env.SESSION
export const commonSecret: string = env.COMMON_SECRET
export const debugSecret: string = env.DEBUG_SECRET
export const recaptcha: string = env.RECAPTCHA
export const port = env.PORT
export const selfDomains: string[] = env.SELF_DOMAINS.split(',')
export const selfDomainsRegex =
    new RegExp('^(https?://)?(' + selfDomains.map(i => i.replace(/\./g, '\\.')).join('|') + ')', 'gs')
let [_primarySelfDomain, ..._otherSelfDomains] = selfDomains

export const primarySelfDomain = _primarySelfDomain
export const otherSelfDomains = _otherSelfDomains
export const externalRedirectPage = env.EXTERNAL_REDIRECT_PAGE

export const smtp = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD
}

export const shikimori = {
    clientId: env.SHIKI_OAUTH_CLIENT_ID,
    clientSecret: env.SHIKI_OAUTH_CLIENT_SECRET,
    appName: env.SHIKI_OAUTH_APP_NAME,
    redirectUri: env.SHIKI_OAUTH_REDIRECT_URI,
    apiEndpoint: env.SHIKI_API_ENDPOINT ?? 'https://shikimori.one/api',
    endpoint: env.SHIKI_ENDPOINT ?? 'https://shikimori.one'
}

// export const anidb = {
//     client: env.ANIDB_CLIENT,
//     clientVer: env.ANIDB_CLIENT_VER,
//     testLogin: env.ANIDB_TEST_LOGIN,
//     testPassword: env.ANIDB_TEST_PASSWORD,
//     udpPort: parseInt(env.ANIDB_UDP_PORT)
// }

export const telegram = {
    token: env.TG_TOKEN,
    channel: env.TG_CHANNEL,
    admin: env.TG_ADMIN,
    proxy: env.TG_PROXY
}

export const firebaseToken = env.FIREBASE_TOKEN
export const github = {
    token: env.GITHUB_TOKEN,
    donationsRepo: env.GITHUB_DONATIONS_REPO,
    donationsFile: env.GITHUB_DONATIONS_FILE
}

export const supportedLanguages = ['ru'] as const
export type SupportedLanguage = typeof supportedLanguages[number]
