import directoryLoader, { LoadedDefaultModule } from '../helpers/directory-loader'
import { AnyKV } from '@/types/utils'

export default directoryLoader<LoadedDefaultModule<AnyKV, () => void>>(__dirname, mod => mod.default())
