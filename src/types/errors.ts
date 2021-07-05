
export class ApiError extends Error {
    static UnknownMethod = new ApiError('Unknown method')
    static TooManyRequests = new ApiError('Too many requests')
    static CaptchaNeeded = new ApiError('CAPTCHA', 'Action confirmation required')
    public code: string
    public description?: string

    constructor (code: string, description?: string) {
        super(`API Error: ${code}`)

        this.code = code
        this.description = description
    }

    // shorthand
    static e (code: string, description?: string): never {
        throw new ApiError(code, description)
    }
}

export class ApiValidationError extends ApiError {
    constructor (errors: string | string[]) {
        super('VALIDATION_ERROR', Array.isArray(errors) ? errors.join('; ') : errors)
    }

    // shorthand
    static e (...errors: string[]): never {
        throw new ApiValidationError(errors)
    }
}

export class ObsoleteError extends ApiError {
    constructor (reason?: string) {
        super('Obsolete', reason)
    }
}