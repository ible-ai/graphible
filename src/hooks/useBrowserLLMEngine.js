// Provides the correct model inference engine from assorted providers for each supported model.

import { WEBLLM_STATE, BROWSER_LLM_TO_PROVIDER, BROWSER_LLM_PROVIDERS } from '../constants/graphConstants';
import { MLCEngine } from "@mlc-ai/web-llm";
import { pipeline, TextGenerationPipeline, TextStreamer } from "@huggingface/transformers";


export class BrowserLLMEngine {
    /**
     * @param {Promise<TextGenerationPipeline>} transformersJsPipeline
     * @param {MLCEngine} mlcEngine
    */
    // * @param {TextGenerationPipeline} transformersJsEngine
    constructor({ config, setWebllmLoadState, setWebllmLoadingProgress }) {
        console.log("Constructing BrowserLLMEngine with config:", config);
        this.modelId = config?.model
        if (config == null || config?.model == null || !BROWSER_LLM_TO_PROVIDER.has(config.model)) {
            console.error("Could not match specified model: ", config);
            console.error("Currently supported/available models: ", BROWSER_LLM_TO_PROVIDER);
            throw Error("Browser model not able to be loaded based on the provided config: ", config);
        }
        const cachedProgressParser = new RegExp("([0-9]+)/([0-9]+)");
        const initProgressCallback = (progress) => {
            if (progress && progress.progress == 0 && progress.text) {
                const match = progress.text.match(cachedProgressParser);
                if (match) {
                    const current = parseInt(match[1]);
                    const total = parseInt(match[2]);
                    progress.progress = current / total;
                }
                setWebllmLoadState(WEBLLM_STATE.RELOADING);
            } else {
                setWebllmLoadState(WEBLLM_STATE.DOWNLOADING);
            }
            setWebllmLoadingProgress(progress);
        };

        this.config = config;
        const provider = BROWSER_LLM_TO_PROVIDER.get(config.model);
        if (provider == BROWSER_LLM_PROVIDERS.MLC_AI__WEB_LLM) {
            this.mlcEngine = new MLCEngine({ initProgressCallback: initProgressCallback });
            this.transformersJsPipeline = null;
        } else if (provider == BROWSER_LLM_PROVIDERS.TRANSFORMERS_JS) {
            this.transformersJsPipeline = pipeline(
                "text-generation",
                config.model,
                { dtype: config.dtype || 'fp16', device: "webgpu" },
            );
            this.mlcEngine = null;
        }
        this.transformersJsEngine = null;
    };

    async load() {
        if (this?.mlcEngine) {
            await this.mlcEngine.reload(this.config.model);
        } else if (this?.transformersJsPipeline) {
            this.transformersJsEngine = await this.transformersJsPipeline;
        }
    };

    async stream(messages) {
        if (this?.transformersJsPipeline) {
            if (!this?.transformersJsEngine) {
                throw Error("Need to load model before trying to generate");
            }
            if (!this.transformersJsEngine?.tokenizer) {
                throw Error("Unable to load model tokenizer. This was the loaded object from config at the time of failure:", this.transformersJsEngine);
            }
            if (!this?.transformersJsEngine) {
                throw Error("Unable to load model Transformers.js model. This was the loaded object from config at the time of failure:", this.transformersJsEngine);
            }
            const engine = this.transformersJsEngine;
            try {
                const readableStream = new ReadableStream({
                    async start(controller) {
                        try {

                            // Try without streaming first to see if basic generation works
                            await engine(
                                [{ role: "user", content: messages }], {
                                max_new_tokens: 2048,
                                do_sample: false,
                                streamer: new TextStreamer(engine.tokenizer, {
                                    skip_prompt: true, callback_function: (text) => {
                                        const formattedChunk = JSON.stringify({ response: text });
                                        controller.enqueue(new TextEncoder().encode(formattedChunk + '\n'));
                                    }
                                }),
                            });
                            controller.close();
                        } catch (error) {
                            console.error('Transformers.js streaming error:', error);
                            controller.error(error);
                        }
                    }
                });
                return readableStream;
            } catch (error) {
                console.error(error);
                throw error;
            }


        } else if (this?.mlcEngine) {
            const generator = await this.mlcEngine.chat.completions.create({
                messages: [{ role: "user", content: messages }],
                stream: true,
                temperature: 0.7,
                max_tokens: 2048,
            });
            const readableStream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of generator) {
                            if (chunk.choices[0]?.delta?.content) {
                                const text = chunk.choices[0].delta.content;
                                const formattedChunk = JSON.stringify({ response: text });
                                controller.enqueue(new TextEncoder().encode(formattedChunk + '\n'));
                            }
                        }
                        controller.close();
                    } catch (error) {
                        console.error('WebLLM streaming error:', error);
                        controller.error(error);
                    }
                }
            });
            return readableStream;
        }

        // Fallback if no engine is available
        console.error('No valid engine found for streaming. transformersJsPipeline:', !!this?.transformersJsPipeline, 'mlcEngine:', !!this?.mlcEngine);
        throw new Error('No valid engine configured for streaming');
    };
    async generate(messages) {
        if (this?.transformersJsPipeline) {
            const result = await this.transformersJsPipeline(
                messages, { max_new_tokens: 2048 });
            return result[0]?.generated_text;
        } else if (this?.mlcEngine) {
            const responses = await this.mlcEngine.chat.completions.create({
                messages: [{ role: "user", content: messages }],
                stream: false,
                temperature: 0.7,
                max_tokens: 2048,
            });
            return responses[0]?.message?.content
        }
    };
};