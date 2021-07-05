import { Queue } from 'bullmq'

export const StatisticsQueue = new Queue('Statistics')
export const TLoggerQueue = new Queue('TLogger')
export const FirebaseNotifierQueue = new Queue('FirebaseNotifier')
export const TranslationNotifierQueue = new Queue('TranslationNotifier')
export const ParsersQueue = new Queue('Parsers')

StatisticsQueue.on('error', console.error)
TLoggerQueue.on('error', console.error)
FirebaseNotifierQueue.on('error', console.error)
TranslationNotifierQueue.on('error', console.error)
ParsersQueue.on('error', console.error)
