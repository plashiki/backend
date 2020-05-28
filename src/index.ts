import { DEBUG } from '@/helpers/debug'
import init from './init'

DEBUG.boot('Bootstrapping API')

init().catch(console.error)
