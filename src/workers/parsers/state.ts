export const parsersState = {
    importers: {
        running: false,
        states: {}
    },
    mappers: {
        running: false,
        states: {}
    },
    cleaners: {
        running: false,
        states: {}
    }
}
export type ParsersState = typeof parsersState
