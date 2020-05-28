export interface InNotification {
    /**
     * Type of action -- push notification
     */
    act: 'push'

    /**
     * Notification ID
     */
    id: number

    /**
     * Action type: C - create, U - update, D - delete
     */
    type: 'C' | 'U' | 'D'

    /**
     * List of topics of the notification
     */
    topics?: string[]

    /**
     * Progress of the notification
     */
    progress?: number

    /**
     * Payload of the notification
     */
    data?: any
}
