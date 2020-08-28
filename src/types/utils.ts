export type StringKV = Record<string, string>
export type AnyKV = Record<string, any>
export type Constructor<T = any, P extends Array<any> = any[]> = new (...args: P) => T
export type OptionalRecord<K extends keyof any, T> = {
    [P in K]?: T;
};

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>
export type Numeric = string | number


export function numericToNumber (i: Numeric | undefined): number {
    if (i === undefined) return NaN
    return typeof i === 'string' ? parseInt(i) : i
}