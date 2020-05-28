import { User } from '@/models/User'

export abstract class AuthService {
    async registerUser (fields: Partial<User>): Promise<User> {
        return User.create(fields).save()
    }
}
