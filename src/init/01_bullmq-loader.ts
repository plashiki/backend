import directoryLoader from '@/helpers/directory-loader'
import { join } from 'path'

export default directoryLoader(join(__dirname, '../workers/sub'), mod => mod)
