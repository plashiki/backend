export interface ApiOverWebsocket {
    /**
     * Describes the action - api request
     */
    act: 'api'

    /**
     * Optionally - request ID. Client should keep track of them on their own.
     * Will be returned with the response to map with the request
     */
    id?: number

    /**
     * HTTP method. Defaults to GET
     */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

    /**
     * Endpoint path. Should not include the base url, nor query string.
     */
    path: string

    /**
     * Query params
     */
    query?: object

    /**
     * Request body
     */
    body?: object | object[]
}
