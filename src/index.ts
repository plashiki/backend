import { LOG } from '@/helpers/logging'
import init from './init'

LOG.boot.info('Bootstrapping API')

init().catch(console.error)
