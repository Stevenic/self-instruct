

export interface ModelSettings {
    model: string;
    max_input_tokens?: number;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: object;
}

export class PromptManager<TAppContext = any> {

}