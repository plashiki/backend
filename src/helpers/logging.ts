import { createLogger, format, Logger, transports } from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { isProduction } from '@/config'

const _loggers: Record<string, Logger> = {}

// winston typings suck
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getFormat = (name: string) => {
    if (isProduction) {
        return format.combine(
            format.splat(),
            format.timestamp(),
            format.json()
        )
    }
    return format.combine(
        format.label({ label: name }),
        format.splat(),
        format.colorize(),
        format.ms(),
        format.printf(({ message, level, label, ms }) => {
            return `${ms} [${label}] ${level}: ${message}`
        })
    )
}

export const getLogger = (name: string): Logger => {
    if (!(name in _loggers)) {
        _loggers[name] = createLogger({
            transports: isProduction ? [
                new transports.Console({ level: 'info' }),
                new DailyRotateFile({
                    filename: `${name}-%DATE%.log`,
                    dirname: `logs/${name}`,
                    maxSize: '10m',
                    maxFiles: '7d',
                    level: 'silly'
                })
            ] : [
                new transports.Console({ level: 'silly' }),
            ],
            format: getFormat(name)
        })
    }

    return _loggers[name]
}

const loggers = [
    'boot',
    'notify',
    'relations',
    'parsers',
    'telegram',
    'shikiApi'
] as const
type LoggerName = typeof loggers[number]

export const LOG: Record<LoggerName, Logger> = {} as any

loggers.forEach((it) => {
    Object.defineProperty(LOG, it, {
        value: getLogger(it),
        writable: false
    })
})