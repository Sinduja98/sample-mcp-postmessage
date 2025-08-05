// MCP Client - Updated for Real Ozwell API Integration
class MCPClient {
    constructor() {
        this.ozwell = new OzwellIntegration();
        this.chatHistory = [];
        this.requestCounter = 0;
        this.mcpServer = null;
        this.context = null;
        
        this.initializeUI();
        this.configureOzwell();
        this.initializeMCP();
        this.setupMessageListener();
    }

    configureOzwell() {
        // Configure Ozwell API credentials
        // You can set these via environment variables, config file, or user input
        const config = {
            apiKey: this.getApiKey(), // Implement this method to securely get API key
            baseUrl: 'https://ai.bluehive.com/api/v1/completion', // Update with actual endpoint
            model: 'ozwell-medical-v1' // Update with actual model name
        };
        
        this.ozwell.configure(config);
        
        // Test the connection
        this.testOzwellConnection();
    }

    getApiKey() {
        // Priority order for getting API key:
        // 1. Environment variable (if available in your environment)
        // 2. Local storage (be careful with security)
        // 3. User input prompt
        // 4. Configuration file
        
        // Option 1: From environment (Node.js style - may not work in browser)
        if (typeof process !== 'undefined' && process.env && process.env.OZWELL_API_KEY) {
            return process.env.OZWELL_API_KEY;
        }
        
        // Option 2: From local storage (use with caution)
        const storedKey = localStorage.getItem('ozwell_api_key');
        if (storedKey) {
            return storedKey;
        }
        
        // Option 3: Prompt user (you might want to do this in a modal instead)
        const userKey = this.promptForApiKey();
        if (userKey) {
            // Optionally store it (be careful about security)
            localStorage.setItem('ozwell_api_key', userKey);
            return userKey;
        }
        
        // Option 4: Return empty string to fall back to simulation
        console.warn('No Ozwell API key found, will fall back to simulation mode');
        return '';
    }

    promptForApiKey() {
        // You might want to replace this with a proper modal dialog
        const key = prompt('Please enter your Ozwell API key (or leave empty to use simulation mode):');
        return key ? key.trim() : '';
    }

    async testOzwellConnection() {
        try {
            this.updateStatus('connecting', 'Testing Ozwell API connection...');
            const result = await this.ozwell.testConnection();
            
            if (result.success) {
                this.addSystemMessage('✅ Connected to Ozwell AI successfully');
                this.updateStatus('connected', 'Ozwell AI connected');
            } else {
                this.addSystemMessage('⚠️ Ozwell API connection failed, using simulation mode');
                this.updateStatus('warning', 'Using simulation mode');
            }
        } catch (error) {
            console.error('Ozwell connection test error:', error);
            this.addSystemMessage('⚠️ Ozwell API not available, using simulation mode');
            this.updateStatus('warning', 'Using simulation mode');
        }
    }

    initializeUI() {
        this.chatContainer = document.getElementById('chatContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        
        // Add API key configuration button
        // this.addConfigButton();
        
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    // addConfigButton() {
    //     // Add a configuration button to the UI
    //     const configButton = document.createElement('button');
    //     configButton.textContent = '⚙️ Configure API';
    //     configButton.style.cssText = `
    //         position: absolute;
    //         top: 10px;
    //         right: 10px;
    //         padding: 5px 10px;
    //         background: #f0f0f0;
    //         border: 1px solid #ccc;
    //         border-radius: 4px;
    //         cursor: pointer;
    //     `;
        
    //     configButton.addEventListener('click', () => this.showConfigDialog());
    //     document.body.appendChild(configButton);
    // }

    showConfigDialog() {
        // Simple config dialog - you might want to make this more sophisticated
        const currentKey = localStorage.getItem('ozwell_api_key') || '';
        const newKey = prompt('Enter Ozwell API Key:', currentKey);
        
        if (newKey !== null) { // User didn't cancel
            if (newKey.trim()) {
                localStorage.setItem('ozwell_api_key', newKey.trim());
                this.ozwell.configure({ apiKey: newKey.trim() });
                this.addSystemMessage('🔄 API key updated, testing connection...');
                this.testOzwellConnection();
            } else {
                localStorage.removeItem('ozwell_api_key');
                this.ozwell.configure({ apiKey: '' });
                this.addSystemMessage('🔄 API key removed, using simulation mode');
                this.updateStatus('warning', 'Using simulation mode');
            }
        }
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'mcp-context') {
                this.patientContext = event.data.context;
                this.addSystemMessage('Patient context loaded successfully');
            } else if (event.data.type === 'mcp-response') {
                this.handleToolResponse(event.data);
            } 
            // else if (event.data.type === 'run-simulation') {
            //     this.runSimulation(event.data.tasks);
            // }
        });
    }

    updateStatus(status, message) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        if (statusText) {
            statusText.textContent = message;
        }
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
            this.addSystemMessage(`❌ Error: ${error.message}`);
        }
        
        this.updateStatus('connected', 'Ready');
    }

    async processMessage(message) {
        // Get AI response
        let responseMessage = null;
        let fullResponse = '';
        
        try {
            const response = await this.ozwell.generateResponse(this.chatHistory, (chunk) => {
                if (!responseMessage) {
                    responseMessage = this.addMessage('', 'assistant', true);
                }
                fullResponse += chunk;
                const contentDiv = responseMessage.querySelector('.message-content');
                if (contentDiv) {
                    contentDiv.textContent = this.ozwell.formatResponse(fullResponse);
                }
            });
            
            console.log('=== MCP Client Response Debug ===');
            console.log('Raw API response:', response);
            console.log('Response type:', typeof response);
            console.log('Response length:', response ? response.length : 0);
            
            // If we didn't get streaming, add the full response
            if (!responseMessage) {
                const formattedResponse = this.ozwell.formatResponse(response);
                console.log('Formatted response for display:', formattedResponse);
                responseMessage = this.addMessage(formattedResponse, 'assistant');
                fullResponse = response; // Keep the original response for tool call parsing
            }
            
            // Remove streaming indicator
            if (responseMessage) {
                responseMessage.id = '';
            }
            
            this.chatHistory.push({ role: 'assistant', content: fullResponse });
            console.log('Added to chat history:', fullResponse);
            console.log('=== End Response Debug ===');
            
            // Check for tool calls
            const toolCalls = this.ozwell.parseToolCalls(fullResponse);
            if (toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    await this.executeTool(toolCall.name, toolCall.parameters);
                }
            }
        } catch (error) {
            console.error('Error in processMessage:', error);
            throw error;
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

    // Method to manually refresh API connection
    async refreshConnection() {
        this.addSystemMessage('🔄 Refreshing connections...');
        await this.testOzwellConnection();
        await this.initializeMCP();
    }

    // Method to clear chat history
    clearChat() {
        this.chatHistory = [];
        this.chatContainer.innerHTML = '';
        this.addSystemMessage('💬 Chat cleared');
    }

    // Method to export chat history
    exportChat() {
        const chatData = {
            timestamp: new Date().toISOString(),
            messages: this.chatHistory,
            context: this.context
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `medical-chat-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addSystemMessage('📄 Chat exported successfully');
    }

    // Method to handle errors gracefully
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        const errorMessage = error.message || 'Unknown error occurred';
        this.addSystemMessage(`❌ Error${context ? ` in ${context}` : ''}: ${errorMessage}`);
        
        // If it's an API error, suggest checking configuration
        if (errorMessage.includes('API') || errorMessage.includes('fetch') || errorMessage.includes('network')) {
            this.addSystemMessage('💡 Tip: Check your API configuration or network connection');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mcpClient = new MCPClient();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+R to refresh connections
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            window.mcpClient.refreshConnection();
        }
        
        // Ctrl+L to clear chat
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            window.mcpClient.clearChat();
        }
        
        // Ctrl+E to export chat
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            window.mcpClient.exportChat();
        }
    });
});