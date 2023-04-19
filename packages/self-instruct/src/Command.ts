
export interface Command<TArguments = Record<string, any>> {
    execute(args: TArguments): Promise<any>;
}

export interface CommandUsage {
    name: string;
    use: string;
    input?: string;
    output?: string;
}
