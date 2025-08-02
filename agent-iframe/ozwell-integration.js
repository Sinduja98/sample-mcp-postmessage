import { MedicalMCPServer } from './medical-mcp-server.js';

// Ozwell Integration for Medical MCP Server
export class OzwellIntegration {
    constructor() {
        this.mcpServer = null;
        // Add Ozwell API configuration
        this.ozwellConfig = {
            apiUrl: 'https://ai.bluehive.com/api/v1/completion', // Replace with actual Ozwell API URL
            apiKey: 'PLACE API key here',
            model: 'ozwell-medical-v1' // Replace with actual model name
        };
    }

    async initialize() {
        this.mcpServer = await new MedicalMCPServer().initialize();
        return this;
    }

    // NEW: Real Ozwell API integration methods
    async generateResponse(chatHistory, onChunk = null) {
        try {
            const response = await fetch(`${this.ozwellConfig.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.ozwellConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: this.ozwellConfig.model,
                    messages: chatHistory,
                    stream: !!onChunk,
                    tools: this.getAvailableTools()
                })
            });

            if (!response.ok) {
                throw new Error(`Ozwell API error: ${response.status}`);
            }

            if (onChunk) {
                // Handle streaming response
                const reader = response.body.getReader();
                let fullResponse = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = new TextDecoder().decode(value);
                    const lines = chunk.split('\n').filter(line => line.trim());
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    fullResponse += content;
                                    onChunk(content);
                                }
                            } catch (e) {
                                console.warn('Failed to parse streaming chunk:', e);
                            }
                        }
                    }
                }
                
                return fullResponse;
            } else {
                // Handle regular response
                const data = await response.json();
                return data.choices?.[0]?.message?.content || '';
            }
        } catch (error) {
            console.error('Error calling Ozwell API:', error);
            throw error;
        }
    }

    parseToolCalls(response) {
        // Parse tool calls from Ozwell response
        // This would depend on Ozwell's specific format
        const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
        const toolCalls = [];
        let match;
        
        while ((match = toolCallRegex.exec(response)) !== null) {
            try {
                const toolCall = JSON.parse(match[1]);
                toolCalls.push(toolCall);
            } catch (e) {
                console.warn('Failed to parse tool call:', match[1]);
            }
        }
        
        return toolCalls;
    }

    formatResponse(response) {
        // Format Ozwell response for display
        return response
            .replace(/<tool_call>.*?<\/tool_call>/gs, '') // Remove tool call markers
            .trim();
    }

    getAvailableTools() {
        // Return tools available to Ozwell
        return [
            {
                type: 'function',
                function: {
                    name: 'addMedication',
                    description: 'Add a new medication to patient records',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Name of the medication' },
                            frequency: { type: 'string', description: 'How often to take the medication' },
                            indication: { type: 'string', description: 'Reason for prescribing' }
                        },
                        required: ['name', 'frequency', 'indication']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'discontinueMedication',
                    description: 'Discontinue an existing medication',
                    parameters: {
                        type: 'object',
                        properties: {
                            medicationName: { type: 'string', description: 'Name or ID of medication to discontinue' }
                        },
                        required: ['medicationName']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'addAllergy',
                    description: 'Add a new allergy to patient records',
                    parameters: {
                        type: 'object',
                        properties: {
                            allergen: { type: 'string', description: 'The substance the patient is allergic to' },
                            reaction: { type: 'string', description: 'The type of reaction' },
                            severity: { type: 'string', enum: ['Mild', 'Moderate', 'Severe'], description: 'Severity of the allergic reaction' }
                        },
                        required: ['allergen', 'reaction', 'severity']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'getContext',
                    description: 'Get current patient context',
                    parameters: {
                        type: 'object',
                        properties: {}
                    }
                }
            }
        ];
    }

    async addMedication(name, frequency, indication) {
        try {
            const context = await this.mcpServer.executeTool('getContext');
            
            const result = await this.mcpServer.executeTool('addMedication', {
                name,
                frequency,
                indication
            }, context);
            
            return result;
        } catch (error) {
            console.error('Error adding medication:', error);
            throw error;
        }
    }

    async discontinueMedication(medicationName) {
        try {
            const context = await this.mcpServer.executeTool('getContext');
            
            const result = await this.mcpServer.executeTool('discontinueMedication', 
                medicationName, 
                context
            );
            
            return result;
        } catch (error) {
            console.error('Error discontinuing medication:', error);
            throw error;
        }
    }

    async addAllergy(allergen, reaction, severity) {
        try {
            return await this.mcpServer.executeTool('addAllergy', {
                allergen,
                reaction,
                severity
            });
        } catch (error) {
            console.error('Error adding allergy:', error);
            throw error;
        }
    }

    async getContext() {
        try {
            return await this.mcpServer.executeTool('getContext', {});
        } catch (error) {
            console.error('Error getting context:', error);
            throw error;
        }
    }
}