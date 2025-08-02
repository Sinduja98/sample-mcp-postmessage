import { OzwellIntegration } from './ozwell-integration.js';
import { MedicalMCPServer } from './medical-mcp-server.js';

// MCP Client - Handles chat interface and tool execution
export class MCPClient {
    constructor() {
        this.toolResponseCallbacks = new Map();
        this.nextRequestId = 1;
        this.ozwell = new OzwellIntegration();
        this.chatHistory = [];
        this.requestCounter = 0;
        this.mcpServer = null;
        this.context = null;
    }

    async initialize() {
        window.addEventListener('message', this.handleMessage.bind(this));
        this.initializeUI();
        this.initializeMCP();
        return this;
    }

    handleMessage(event) {
        const { data } = event;
        
        if (data.type === 'mcp-tool-call') {
            // Handle incoming tool calls
            this.handleToolCall(data)
                .then(result => {
                    event.source.postMessage({
                        type: 'mcp-tool-response',
                        requestId: data.requestId,
                        result
                    }, '*');
                })
                .catch(error => {
                    event.source.postMessage({
                        type: 'mcp-tool-response',
                        requestId: data.requestId,
                        error: error.message
                    }, '*');
                });
        } else if (data.type === 'mcp-context') {
            this.patientContext = data.context;
            this.addSystemMessage('Patient context loaded successfully');
        } else if (data.type === 'mcp-response') {
            this.handleToolResponse(data);
        } else if (data.type === 'run-simulation') {
            this.runSimulation(data.tasks);
        }
    }

    initializeUI() {
        this.chatContainer = document.getElementById('chatContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    updateStatus(status, message) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        statusIndicator.className = `status-indicator ${status}`;
        statusText.textContent = message;
    }

    addMessage(content, sender, isStreaming = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        if (isStreaming) {
            messageDiv.id = 'streaming-message';
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        
        return messageDiv;
    }

    addSystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `<div class="message-content"><em>${content}</em></div>`;
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;
        
        this.userInput.value = '';
        this.addMessage(message, 'user');
        this.chatHistory.push({ role: 'user', content: message });
        
        this.updateStatus('thinking', 'AI is thinking...');
        
        try {
            await this.processMessage(message);
        } catch (error) {
            console.error('Error processing message:', error);
            this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        }
        
        this.updateStatus('connected', 'Ready');
    }

    async processMessage(message) {
        // Get AI response
        let responseMessage = null;
        let fullResponse = '';
        
        const response = await this.ozwell.generateResponse(this.chatHistory, (chunk) => {
            if (!responseMessage) {
                responseMessage = this.addMessage('', 'assistant', true);
            }
            fullResponse += chunk;
            responseMessage.querySelector('.message-content').textContent = 
                this.ozwell.formatResponse(fullResponse);
        });
        
        // Remove streaming indicator
        if (responseMessage) {
            responseMessage.id = '';
        }
        
        this.chatHistory.push({ role: 'assistant', content: response });
        
        // Check for tool calls
        const toolCalls = this.ozwell.parseToolCalls(response);
        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                await this.executeTool(toolCall.name, toolCall.parameters);
            }
        }
    }

    async executeTool(toolName, parameters) {
        this.updateStatus('executing', `Executing ${toolName}...`);
        
        const requestId = ++this.requestCounter;
        
        return new Promise((resolve, reject) => {
            // Store request for response handling
            this.pendingRequests = this.pendingRequests || {};
            this.pendingRequests[requestId] = {
                toolName,
                parameters,
                onResponse: (result) => {
                    if (result.success) {
                        // Update context if tool execution was successful
                        if (toolName === 'getContext') {
                            this.context = result.data;
                        }
                        resolve(result);
                    } else {
                        reject(new Error(result.error));
                    }
                }
            };
            
            // Send tool execution request to parent
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: toolName,
                params: parameters
            }, '*');
        }).finally(() => {
            this.updateStatus('connected', 'Ready');
        });
    }

    handleToolResponse(data) {
        const request = this.pendingRequests?.[data.requestId];
        if (!request) return;
        
        // If there's a specific response handler, call it
        if (request.onResponse) {
            request.onResponse(data.result);
        }
        
        delete this.pendingRequests[data.requestId];
        
        if (data.result.success) {
            this.addSystemMessage(`✅ ${request.toolName} completed: ${data.result.message || 'Success'}`);
        } else {
            this.addSystemMessage(`❌ ${request.toolName} failed: ${data.result.error}`);
        }
        
        this.updateStatus('connected', 'Ready');
    }

    async runSimulation(tasks) {
        this.addSystemMessage('🔄 Running simulation with the following tasks...');
        
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between tasks
            
            let message = '';
            switch (task.action) {
                case 'addMedication':
                    message = `Add ${task.data.name} ${task.data.dose} ${task.data.frequency}`;
                    break;
                case 'discontinueMedication':
                    message = `Discontinue ${task.data}`;
                    break;
                case 'addAllergy':
                    message = `Add allergy to ${task.data.allergen}`;
                    break;
            }
            
            this.addMessage(message, 'user');
            this.chatHistory.push({ role: 'user', content: message });
            
            await this.processMessage(message);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for completion
        }
        
        this.addSystemMessage('✅ Simulation completed successfully!');
    }

    async initializeMCP() {
        try {
            this.mcpServer = await new MedicalMCPServer().initialize();
            this.updateStatus('connected', 'Connected to medical system');
            
            // Get initial context
            const requestId = ++this.requestCounter;
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: 'getContext',
                params: {}
            }, '*');

            // Store request for response handling
            this.pendingRequests = this.pendingRequests || {};
            this.pendingRequests[requestId] = { 
                toolName: 'getContext',
                onResponse: (result) => {
                    if (result.success) {
                        this.context = result.data;
                        this.addSystemMessage('Connected to medical system and loaded patient context');
                    }
                }
            };
        } catch (error) {
            console.error('Failed to initialize MCP:', error);
            this.updateStatus('error', 'Failed to connect to medical system');
            this.addSystemMessage('❌ Failed to connect to medical system: ' + error.message);
        }
    }

    async handleToolCall(data) {
        const { tool, params } = data;
        
        // Implement your tool handlers here
        switch (tool) {
            case 'addMedication':
                return await this.addMedication(params);
            case 'discontinueMedication':
                return await this.discontinueMedication(params);
            case 'addAllergy':
                return await this.addAllergy(params);
            case 'getContext':
                return await this.getContext();
            default:
                throw new Error(`Unknown tool: ${tool}`);
        }
    }

    // Tool handler implementations
    async addMedication(params) {
        // Implement medication addition logic
        console.log('Adding medication:', params);
        return { success: true, medicationId: Date.now() };
    }

    async discontinueMedication(params) {
        // Implement medication discontinuation logic
        console.log('Discontinuing medication:', params);
        return { success: true };
    }

    async addAllergy(params) {
        // Implement allergy addition logic
        console.log('Adding allergy:', params);
        return { success: true, allergyId: Date.now() };
    }

    async getContext() {
        // Return current patient context
        return {
            medications: [
                // Sample data - replace with actual patient data
                { id: '1', name: 'Aspirin', frequency: 'daily', indication: 'pain' }
            ],
            allergies: [
                { allergen: 'Penicillin', reaction: 'Rash', severity: 'Moderate' }
            ]
        };
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mcpClient = new MCPClient();
});