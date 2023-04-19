
export interface Memory {
    get<TValue = any>(key: string): TValue|undefined;
    set<TValue = any>(key: string, value: TValue): void;
    has(key: string): boolean;
}