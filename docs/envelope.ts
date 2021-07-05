export interface Envelope<T> {
    /**
     * Whether the request was successful
     */
    ok: boolean

    /**
     * Request result. Present when `ok` is true.
     */
    result?: T

    /**
     * Request failure reason (error code). Present when `ok` is false.
     */
    reason?: string

    /**
     * Request failure reason description. Present sometimes when `ok` is false.
     */
    description?: string

    /**
     * Time it took for the server to process the request (in ms)
     */
    serve_time?: number
}
