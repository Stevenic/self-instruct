import { Memory } from "./Memory";


export class VolatileMemory implements Memory {
    private readonly _memory = new Map<string, any>();

    public constructor(values?: Record<string, any>) {
        if (values) {
            for (const key in values) {
                if (values.hasOwnProperty(key)) {
                    const value = values[key];
                    this.set(key, value);
                }
            }
        }
    }

    public get<TValue = any>(key: string): TValue|undefined {
        return this._memory.get(key.toLowerCase());
    }

    public set<TValue = any>(key: string, value: TValue): void {
        if (value != undefined) {
            this._memory.set(key.toLowerCase(), value);
        } else if (this._memory.has(key.toLowerCase())) {
            this._memory.delete(key.toLowerCase());
        }
    }

    public has(key: string): boolean {
        return this._memory.has(key.toLowerCase());
    }

    public toJSON(): Record<string, any> {
        const memory = {} as Record<string, any>;
        this._memory.forEach((value, key) => {
            memory[key] = value;
        });
        return memory;
    }
}