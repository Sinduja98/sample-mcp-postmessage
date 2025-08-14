// LLM Manager - Handles multiple LLM providers (OpenAI, Ozwell)
class LLMManager {
    constructor() {
        this.currentProvider = null;
        this.providers = {
            openai: {
                name: 'OpenAI',
                apiKey: null,
                model: 'gpt-3.5-turbo',
                baseUrl: 'https://api.openai.com/v1/chat/completions',
                configured: false
            },
            ozwell: {
                name: 'Ozwell',
                apiKey: null,
                model: 'ozwell-medical-v1',
                baseUrl: 'https://ai.bluehive.com/api/v1/completion',
                configured: false
            }
        };
        
        // Load saved configurations
        this.loadSavedConfigurations();
    }

    loadSavedConfigurations() {
        // Load OpenAI configuration
        const openaiKey = localStorage.getItem('openai_api_key');
        const openaiModel = localStorage.getItem('openai_model');
        if (openaiKey) {
            this.providers.openai.apiKey = openaiKey;
            this.providers.openai.configured = true;
            if (openaiModel) {
                this.providers.openai.model = openaiModel;
            }
        }

        // Load Ozwell configuration
        const ozwellKey = localStorage.getItem('ozwell_api_key');
        const ozwellModel = localStorage.getItem('ozwell_model');
        const ozwellUrl = localStorage.getItem('ozwell_api_url');
        if (ozwellKey) {
            this.providers.ozwell.apiKey = ozwellKey;
            this.providers.ozwell.configured = true;
            if (ozwellModel) {
                this.providers.ozwell.model = ozwellModel;
            }
            if (ozwellUrl) {
                this.providers.ozwell.baseUrl = ozwellUrl;
            }
        }

        // Load current provider selection
        const savedProvider = localStorage.getItem('current_llm_provider');
        if (savedProvider && this.providers[savedProvider]?.configured) {
            this.currentProvider = savedProvider;
        }
    }

    saveConfiguration(provider, config) {
        if (!this.providers[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }

        // Save to localStorage
        localStorage.setItem(`${provider}_api_key`, config.apiKey);
        localStorage.setItem(`${provider}_model`, config.model);
        if (config.baseUrl) {
            localStorage.setItem(`${provider}_api_url`, config.baseUrl);
        }

        // Update provider configuration
        this.providers[provider] = {
            ...this.providers[provider],
            ...config,
            configured: true
        };

        console.log(`${provider} configuration saved successfully`);
        return true;
    }

    setCurrentProvider(provider) {
        if (!this.providers[provider]) {
            throw new Error(`Unknown provider: ${provider}`);
        }

        if (!this.providers[provider].configured) {
            throw new Error(`Provider ${provider} is not configured`);
        }

        this.currentProvider = provider;
        localStorage.setItem('current_llm_provider', provider);
        console.log(`Current LLM provider set to: ${provider}`);
        return true;
    }

    getCurrentProvider() {
        return this.currentProvider;
    }

    getProviderConfig(provider = null) {
        const target = provider || this.currentProvider;
        if (!target) {
            throw new Error('No provider specified and no current provider set');
        }
        return this.providers[target];
    }

    isProviderConfigured(provider) {
        return this.providers[provider]?.configured || false;
    }

    getConfigurationFields(provider) {
        const fields = {
            openai: [
                { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
                { name: 'model', label: 'Model', type: 'text', placeholder: 'gpt-3.5-turbo' }
            ],
            ozwell: [
                { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'BHSK-...' },
                { name: 'model', label: 'Model', type: 'text', placeholder: 'ozwell-medical-v1' },
                { name: 'baseUrl', label: 'API URL', type: 'text', placeholder: 'https://ai.bluehive.com/api/v1/completion' }
            ]
        };
        return fields[provider] || [];
    }

    async generateResponse(messages, onChunk = null) {
        if (!this.currentProvider) {
            throw new Error('No LLM provider selected');
        }

        const provider = this.providers[this.currentProvider];
        if (!provider.configured) {
            throw new Error(`Provider ${this.currentProvider} is not configured`);
        }

        switch (this.currentProvider) {
            case 'openai':
                return await this.callOpenAI(messages, provider, onChunk);
            case 'ozwell':
                return await this.callOzwell(messages, provider, onChunk);
            default:
                throw new Error(`Unsupported provider: ${this.currentProvider}`);
        }
    }

    async callOpenAI(messages, provider, onChunk = null) {
        // Define available tools for OpenAI function calling
        const tools = [
            {
                type: "function",
                function: {
                    name: "getContext",
                    description: "Retrieve current patient medical information including medications, allergies, and patient details",
                    parameters: {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "addMedication",
                    description: "Add a new medication to the patient's medication list",
                    parameters: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the medication (e.g., 'Paracetamol', 'Ibuprofen')"
                            },
                            dose: {
                                type: "string",
                                description: "Dosage amount (e.g., '500mg', '650mg')"
                            },
                            frequency: {
                                type: "string",
                                description: "How often to take the medication (e.g., 'twice daily', 'every 6 hours')"
                            },
                            indication: {
                                type: "string",
                                description: "Reason for prescribing the medication (e.g., 'Pain relief', 'Fever')"
                            }
                        },
                        required: ["name", "dose", "frequency", "indication"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "discontinueMedication",
                    description: "Remove or discontinue a medication from the patient's list",
                    parameters: {
                        type: "object",
                        properties: {
                            medId: {
                                type: "string",
                                description: "Name or ID of the medication to discontinue"
                            }
                        },
                        required: ["medId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "addAllergy",
                    description: "Add a new allergy to the patient's allergy list",
                    parameters: {
                        type: "object",
                        properties: {
                            allergen: {
                                type: "string",
                                description: "The substance the patient is allergic to (e.g., 'Penicillin', 'Sulfa')"
                            },
                            reaction: {
                                type: "string",
                                description: "The type of reaction experienced (e.g., 'Hives', 'Difficulty breathing')"
                            },
                            severity: {
                                type: "string",
                                description: "Severity level of the allergy",
                                enum: ["Mild", "Moderate", "Severe"]
                            }
                        },
                        required: ["allergen", "reaction", "severity"]
                    }
                }
            }
        ];

        const requestBody = {
            model: provider.model,
            messages: messages,
            tools: tools,
            tool_choice: "auto", // Let OpenAI decide when to use tools
            temperature: 0.7,
            max_tokens: 1000,
            stream: !!onChunk
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
        };

        if (onChunk) {
            return await this.handleStreamingResponse(provider.baseUrl, requestBody, headers, onChunk);
        } else {
            return await this.handleNonStreamingResponse(provider.baseUrl, requestBody, headers);
        }
    }

    async callOzwell(messages, provider, onChunk = null) {
        // Convert OpenAI-style messages to Ozwell prompt format
        const prompt = this.convertMessagesToPrompt(messages);

        const requestBody = {
            prompt: prompt,
            temperature: 0.7,
            max_tokens: 1000,
            stream: !!onChunk
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${provider.apiKey}`
        };

        if (onChunk) {
            return await this.handleStreamingResponse(provider.baseUrl, requestBody, headers, onChunk);
        } else {
            return await this.handleNonStreamingResponse(provider.baseUrl, requestBody, headers);
        }
    }

    convertMessagesToPrompt(messages) {
        let prompt = '';
        for (const message of messages) {
            switch (message.role) {
                case 'system':
                    prompt += `System: ${message.content}\n\n`;
                    break;
                case 'user':
                    prompt += `Human: ${message.content}\n\n`;
                    break;
                case 'assistant':
                    prompt += `Assistant: ${message.content}\n\n`;
                    break;
                default:
                    prompt += `${message.content}\n\n`;
            }
        }
        prompt += 'Assistant:';
        return prompt;
    }

    async handleStreamingResponse(url, requestBody, headers, onChunk) {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;

                        try {
                            const parsed = JSON.parse(data);
                            const content = this.extractContentFromStreamChunk(parsed);
                            if (content) {
                                fullResponse += content;
                                if (onChunk) onChunk(content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse streaming chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullResponse.trim();
    }

    async handleNonStreamingResponse(url, requestBody, headers) {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // For OpenAI, return the full message object to preserve tool_calls
        if (this.currentProvider === 'openai' && data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message;
        }
        
        // Handle other response formats (for Ozwell and other providers)
        if (data.choices && data.choices[0]) {
            if (data.choices[0].message) {
                return data.choices[0].message.content;
            } else if (data.choices[0].text) {
                return data.choices[0].text;
            }
        } else if (data.text) {
            return data.text;
        } else if (data.response) {
            return data.response;
        }

        throw new Error('Unexpected response format from API');
    }

    extractContentFromStreamChunk(parsed) {
        if (parsed.choices && parsed.choices[0]) {
            if (parsed.choices[0].delta && parsed.choices[0].delta.content) {
                return parsed.choices[0].delta.content;
            } else if (parsed.choices[0].text) {
                return parsed.choices[0].text;
            }
        } else if (parsed.token) {
            return parsed.token;
        } else if (parsed.text) {
            return parsed.text;
        }
        return '';
    }

    async testConnection(provider = null) {
        const target = provider || this.currentProvider;
        if (!target) {
            throw new Error('No provider specified for testing');
        }

        const testMessages = [
            { role: 'user', content: 'Hello, please respond with a brief test message.' }
        ];

        try {
            const response = await this.generateResponse(testMessages);
            return { success: true, response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getAvailableProviders() {
        return Object.keys(this.providers);
    }

    getProviderName(provider) {
        return this.providers[provider]?.name || provider;
    }

    // Parse tool calls from LLM response based on provider
    parseToolCalls(response, provider = null) {
        const currentProvider = provider || this.currentProvider;
        
        if (currentProvider === 'openai') {
            return this.parseOpenAIToolCalls(response);
        } else if (currentProvider === 'ozwell') {
            return this.parseOzwellToolCalls(response);
        }
        
        return [];
    }

    parseOpenAIToolCalls(response) {
        const toolCalls = [];
        console.log("*** Parsing OpenAI tool calls from response:", response);
        
        // Check if response is a structured object with tool_calls
        if (typeof response === 'object' && response.tool_calls) {
            for (const toolCall of response.tool_calls) {
                if (toolCall.type === 'function') {
                    try {
                        const args = typeof toolCall.function.arguments === 'string' 
                            ? JSON.parse(toolCall.function.arguments)
                            : toolCall.function.arguments;
                        
                        toolCalls.push({
                            id: toolCall.id,
                            name: toolCall.function.name,
                            parameters: args,
                            provider: 'openai'
                        });
                        
                        console.log(`🔧 OpenAI suggested tool: ${toolCall.function.name}`, args);
                    } catch (error) {
                        console.error('Error parsing OpenAI tool call arguments:', error);
                    }
                }
            }
        }
        
        return toolCalls;
    }

    parseOzwellToolCalls(response) {
        const toolCalls = [];
        
        if (typeof response !== 'string') return toolCalls;
        
        const lines = response.split('\n');
        let toolCall = null;
        let params = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('TOOL_CALL:')) {
                toolCall = line.replace('TOOL_CALL:', '').trim();
            } else if (line.startsWith('PARAMS:')) {
                const paramsStr = line.replace('PARAMS:', '').trim();
                try {
                    params = JSON.parse(paramsStr);
                } catch (e) {
                    // If not JSON, treat as string
                    params = paramsStr.replace(/"/g, '');
                }
            }
        }
        
        if (toolCall) {
            toolCalls.push({
                name: toolCall,
                parameters: params,
                provider: 'ozwell'
            });
            
            console.log(`🔧 Ozwell suggested tool: ${toolCall}`, params);
        }
        
        return toolCalls;
    }
}

// Export for use in other modules
window.LLMManager = LLMManager;
