import { Command, CommandUsage, CommandRegistration } from "./Command";
import { Memory } from "./Memory";
import { OpenAIClient } from "./OpenAIClients";
import { PromptManager, ModelSettings } from "./PromptManager";
import * as path from 'path';
import { encode } from 'gpt-3-encoder';
import { VolatileMemory } from "./VolatileMemory";

export interface PromptResponse {
    thoughts: {
        thought: string;
        reasoning: string;
        plan: string;
    };
    command: {
        name: string;
        input: Record<string, any>;
    }
}

export interface TaskManagerConfiguration {
    /**
     * The applications core prompt that's passed to the LLMs.
     */
    prompt: string;

    /**
     * The client to use for making model calls.
     */
    client: OpenAIClient;

    /**
     * Optional. Model settings to use for the initial newTask() prompt. Defaults to using 'gpt-3.5-turbo'
     */
    newTaskModel?: ModelSettings;

    /**
     * Optional. Model settings to use for the continueTask() prompt. Defaults to using 'gpt-3.5-turbo'
     */
    continueTaskModel?: ModelSettings;

    /**
     * Optional. Additional set of rules to pass into the prompt.
     */
    additionalRules?: string[];

    /**
     * Optional. Canned response to lead the task with. Helpful in that it shows the prompt an example
     * of it following instruction. Pretty much essential when passing in a userMessage to newTask().
     */
    leadResponse?: PromptResponse;

    /**
     * Optional. Maximum number of steps the model is allowed to perform without user intervention.
     * Defaults to a value of 5.
     */
    maxSteps?: number;
}

export interface TaskResult {
    status: 'input_needed' | 'completed' | 'too_many_steps';
    response: string;
}

export class TaskManager<TAppContext = any> {
    private static readonly _allCommands = new Map<string, CommandRegistration>();

    // Constants
    private static readonly IN_TASK_PROPERTY = '__in_task__';
    private static readonly TASK_HISTORY_PROPERTY = '__task_history__';

    // Reserved Commands
    private static readonly ASK_COMMAND: CommandUsage = {
        name: 'ask',
        use: `ask the user a question and wait for their response`,
        input: `"question": "<question to ask>"`,
        output: `users answer`
    };
    private static readonly FINAL_ANSWER_COMMAND: CommandUsage = {
        name: 'finalAnswer',
        use: `generate an answer for the user`,
        input: `"question": "<question to ask>"`
    };
    private static readonly RESERVED_COMMANDS = ['', 'ask', 'finalanswer'];

    public static registerCommand(commandFactory: (config: Record<string, any>) => Promise<Command>, usage: CommandUsage, replace = false): void {
        // Ensure name isn't missing or reserved.
        const key = (usage.name ?? '').toLowerCase();
        if (TaskManager.RESERVED_COMMANDS.indexOf(key) >= 0) {
            throw new Error(`The command name "${usage.name}" is either missing or reserved.`);
        }

        // Ensure unique command
        if (TaskManager._allCommands.has(key) && !replace) {
            throw new Error(`The command name "${usage.name}" has already been registered.`);
        }

        // Register command
        TaskManager._allCommands.set(key, {commandFactory, usage});
    }

    public static hasCommand(name: string): boolean {
        const key = (name ?? '').toLowerCase();
        return TaskManager._allCommands.has(key) || TaskManager.RESERVED_COMMANDS.indexOf(key) >= 0;
    }

    // INSTANCE MEMBERS

    private readonly _prompts: PromptManager<TAppContext>;
    private readonly _config: TaskManagerConfiguration;
    private readonly _commands = new Map<string, Command>();
    private _commandsConfigured = false;
    private _commandsUsageTokens = 0;
    private _commandsUsage = '';

    public constructor(config: TaskManagerConfiguration) {
        this._config = Object.assign({}, config);
        const promptsFolder = path.join(__dirname, '../src/prompts');
    }

    public async configureCommands(commands?: { [name: string]: Record<string, any>; }): Promise<void> {
        if (this._commandsConfigured) {
            throw new Error(`The commands for this TaskManager instance have already been configured.`);
        }

        try {
            // Initialize usage for reserved commands
            this._commandsUsage = generateUsage(TaskManager.ASK_COMMAND);
            this._commandsUsage += generateUsage(TaskManager.FINAL_ANSWER_COMMAND);

            // Configure selected commands
            for (const name in commands) {
                const config = commands[name] ?? {};
                const key = name.toLowerCase();

                // Get registration
                const registration = TaskManager._allCommands.get(key);
                if (!registration) {
                    throw new Error(`A command named "${name}" was specified in the configuration for the TaskManager but couldn't be found. Ensure the command has been registered.`);
                }

                // Factory a command instance
                const instance = await registration.commandFactory(config);
                this._commands.set(key, instance);

                // Add it to the usage
                this._commandsUsage += generateUsage(registration.usage);
            }

            // Calculate token count for usage
            const tokens = encode(this._commandsUsage);
            this._commandsUsageTokens = tokens.length;

            this._commandsConfigured = true;
        } finally {
            if (!this._commandsConfigured) {
                this._commandsUsageTokens = 0;
                this._commandsUsage = '';
                this._commands.clear();
            }
        }
    }

    public inTask(memory: Memory): boolean {
        return !!memory.get(TaskManager.IN_TASK_PROPERTY);
    }

    public completeTask(memory: Memory, userMessage: string, context: TAppContext = undefined): Promise<TaskResult> {
        if (this.inTask(memory)) {
            return this.continueTask(memory, userMessage, context);
        } else {
            return this.newTask(memory, userMessage, context);
        }
    }

    public newTask(memory: Memory, userMessage?: string|undefined, context: TAppContext = undefined): Promise<TaskResult> {
        // Initialize conversation history
        memory.set(TaskManager.TASK_HISTORY_PROPERTY, []);
        memory.set(TaskManager.IN_TASK_PROPERTY, true);

        // Run task loop with appropriate overrides
        return this.runTaskLoop(this._config.newTaskModel, memory, userMessage, context);
    }

    public async continueTask(memory: Memory, userMessage: string, context: TAppContext = undefined): Promise<TaskResult> {
        // Ensure we're in an existing task
        if (!this.inTask(memory)) {
            throw new Error(`TaskManager.continueTask() was called but we're not in a task.`)
        }

        // Run task loop with appropriate overrides
        return this.runTaskLoop(this._config.continueTaskModel, memory, userMessage, context);
    }

    private async runTaskLoop(overrides: ModelSettings|undefined, memory: Memory, userMessage: string|undefined, context: TAppContext|undefined): Promise<TaskResult> {
        while (true) {
            // Create prompt

            // Verify that were within our token budget

            // Determine client API to use (chat or text completions)

            // Perform the turn

            // Check for command that was predicted
            // - 'ask' yields with the question
            // - 'finalAnswer' yields with the answer
            // - otherwise execute command and loop
        }
    }
}

function generateUsage(usage: CommandUsage): string {
    return `\t${usage.name}\n\t\tuse: ${usage.use}\n\t\tinput: ${usage.input ?? 'none'}\n\t\toutput: ${usage.output ?? 'none'}\n`;
}


interface CommandRegistration {
    commandFactory: (config: Record<string, any>) => Promise<Command>;
    usage: CommandUsage;
}
