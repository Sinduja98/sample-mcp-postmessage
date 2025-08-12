// MCP Client - Updated to use MCP Tools directly instead of Ozwell responses
class MCPClient {
    constructor() {
        this.ozwell = new OzwellIntegration(); // Used for message analysis, not response generation
        this.chatHistory = [];
        this.requestCounter = 0;
        this.mcpServer = null;
        this.context = null;
        this.availableTools = [];
        this._processingMessage = false;
        
        this.initializeUI();
        this.configureOzwell(); // Keep for potential future use
        this.initializeMCP();
        this.setupMessageListener();
        
        // Listen for when window finishes loading to ensure tools context is passed
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.requestToolsFromMCPServer(), 100);
            });
        } else {
            setTimeout(() => this.requestToolsFromMCPServer(), 100);
        }
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
            console.log('MCPClient received message:', event.data);

            // FILTER: Ignore messages that MCPClient sent
            if (event.data.type === 'mcp-execute-tool' || event.data.type === 'mcp-get-tools') {
                return; // These are sent BY MCPClient, not TO MCPClient
            }
            
            switch (event.data.type) {
                case 'mcp-tools-available':
                    // Receive available tools from MCP Server
                    console.log("*** Received available tools from MCP Server ***", event.data.tools);
                    this.handleToolsReceived(event.data.tools);
                    break;
                    
                case 'mcp-tool-response':
                    // Receive tool execution response from MCP Server
                    this.handleToolExecutionResponse(event.data);
                    break;
                    
                case 'mcp-context':
                    // Receive patient context
                    this.patientContext = event.data.context;
                    this.addSystemMessage('📋 Patient context loaded successfully');
                    break;
                    
                case 'mcp-response':
                    this.handleToolResponse(event.data);
                    break;
                    
                case 'tools-context':
                    // Legacy support - convert to new format
                    if (event.data.toolsContext && event.data.toolsContext.availableTools) {
                        this.handleToolsReceived(event.data.toolsContext.availableTools);
                    }
                    break;
                    
                case 'medication-response':
                    // Handle medication response from parent
                    this.addMessage(event.data.message, 'assistant');
                    this.chatHistory.push({ role: 'assistant', content: event.data.message });
                    break;
                    
                default:
                    console.log('Unknown message type:', event.data.type);
            }
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
        
        // Check for special commands
        if (message.toLowerCase() === '/test-tools') {
            this.userInput.value = '';
            this.addMessage(message, 'user');
            this.testAvailableTools();
            return;
        }
        
        if (message.toLowerCase() === '/help') {
            this.userInput.value = '';
            this.addMessage(message, 'user');
            this.showHelp();
            return;
        }
        
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
        console.log('*** processMessage called with:', message);

     if (this._processingMessage) {
        console.log('*** Already processing a message, skipping duplicate');
        return;
    }
    
    this._processingMessage = true;
        
        try {
            // Analyze user message to determine appropriate MCP tool action
            const toolAction = this.analyzeMessageForToolAction(message);
            
            if (toolAction) {
                console.log('*** Determined tool action:', toolAction);
                this.addSystemMessage(`🔧 Analyzing request: ${toolAction.description}`);
                
                // Execute the appropriate MCP tool
                await this.executeToolViaMCP(toolAction.toolName, toolAction.parameters);
            } else {
                // If no specific tool action is detected, invoke Ozwell for general assistance

                
                console.log('*** No specific tool action detected, invoking Ozwell for general assistance ***');
                
                this.addSystemMessage('🤖 Getting AI response...');
                
                try {
                    // Prepare chat history for Ozwell
                    const ozwellMessages = this.chatHistory.slice(); // Copy chat history
                    
                    // Update Ozwell with current tools context if available
                    // if (this.availableTools && this.availableTools.length > 0) {
                    //     const toolsContext = {
                    //         availableTools: this.availableTools,
                    //         currentContext: this.context,
                    //         sourceLocation: 'mcp-client'
                    //     };
                    //     this.ozwell.updateToolsContext(toolsContext);
                    // }
                    
                    // Generate response using Ozwell
                    const ozwellResponse = await this.ozwell.generateResponse(ozwellMessages);
                    
                    // Check if Ozwell response contains tool calls
                    const toolCalls = this.ozwell.parseToolCalls(ozwellResponse);
                    
                    if (toolCalls && toolCalls.length > 0) {
                        console.log('*** Ozwell suggested tool calls:', toolCalls);
                        
                        // Execute the first tool call suggested by Ozwell
                        const toolCall = toolCalls[0];
                        this.addSystemMessage(`🔧 Ozwell suggests: ${toolCall.name}`);
                        await this.executeToolViaMCP(toolCall.name, toolCall.parameters);
                    } else {
                        // No tool calls, just display Ozwell's response
                        const formattedResponse = this.ozwell.formatResponse(ozwellResponse);
                        this.addMessage(formattedResponse, 'assistant');
                        this.chatHistory.push({ role: 'assistant', content: formattedResponse });
                    }
                    
                } catch (ozwellError) {
                    console.error('Error invoking Ozwell:', ozwellError);
                    this.addSystemMessage('❌ AI response error, falling back to context retrieval...');
                    
                    // Fallback to getting context if Ozwell fails
                    await this.executeToolViaMCP('getContext', {});
                }
            }
        } catch (error) {
            console.error('Error in processMessage:', error);
            throw error;
        } finally {
        // Reset the processing flag
        this._processingMessage = false;
    }
    }

    async executeToolViaMCP(toolName, parameters) {
        this.updateStatus('executing', `Executing ${toolName}...`);
        
        const requestId = ++this.requestCounter;
        
        console.log('*** Sending tool execution request to MCP Server:', {
            toolName,
            parameters,
            requestId
        });
        
        // Send tool execution request to MCP Server via postMessage
        window.postMessage({
            type: 'mcp-execute-tool',
            requestId: requestId,
            toolName: toolName,
            parameters: parameters
        }, '*');
        
        this.addSystemMessage(`🔧 Requested ${toolName} execution from MCP Server`);
    }

    async handleToolResponse(data) {
        // This method is used for legacy compatibility
        // The main response handling is now done in handleToolExecutionResponse
        console.log('handleToolResponse called - delegating to handleToolExecutionResponse');
        return this.handleToolExecutionResponse(data);
    }

    async requestToolsFromMCPServer() {
        console.log('*** Requesting available tools from MCP Server ***');
        
        // Request tools from MCP Server
        window.postMessage({
            type: 'mcp-get-tools'
        }, '*');
        
        this.addSystemMessage('🔍 Requesting available tools from MCP Server...');
    }

    handleToolsReceived(tools) {
        console.log('*** Received tools from MCP Server:', tools);
        this.availableTools = tools;
        
        // Display available tools to user
        const toolNames = tools.map(tool => tool.name).join(', ');
        this.addSystemMessage(`🛠️ Available MCP tools: ${toolNames}`);
        
        this.addSystemMessage('🔧 MCP tools are ready for use');
        
        // Log tool details for debugging
        console.log('Available tools details:', tools);
    }

    createToolDescriptions(tools) {
        const descriptions = {};
        tools.forEach(tool => {
            descriptions[tool.name] = tool.description;
        });
        return descriptions;
    }

    handleToolExecutionResponse(data) {
        console.log('*** Received tool execution response:', data);
        
        const { requestId, toolName, result, success, error, message } = data;
        
        if (success) {
            this.addSystemMessage(`✅ ${toolName} executed successfully`);
            
            // Format and display the response from MCP server
            let responseText = this.formatMCPResponse(toolName, result, message);
            
            // Add the response as an assistant message
            this.addMessage(responseText, 'assistant');
            this.chatHistory.push({ role: 'assistant', content: responseText });
            
        } else {
            this.addSystemMessage(`❌ ${toolName} failed: ${error}`);
            
            // Add error response
            const errorResponseText = `I encountered an error while trying to ${toolName}: ${error}. Please check the details and try again.`;
            this.addMessage(errorResponseText, 'assistant');
            this.chatHistory.push({ role: 'assistant', content: errorResponseText });
        }
        
        this.updateStatus('connected', 'Ready');
    }

    formatMCPResponse(toolName, result, message) {
        switch (toolName) {
            case 'getContext':
                return this.formatContextResponse(result);
                
            case 'addMedication':
                return this.formatMedicationResponse(result, message);
                
            case 'discontinueMedication':
                return this.formatDiscontinueResponse(result, message);
                
            case 'addAllergy':
                return this.formatAllergyResponse(result, message);
                
            default:
                return message || 'Operation completed successfully.';
        }
    }

    formatContextResponse(contextData) {
        if (!contextData) return 'Unable to retrieve patient context.';
        
        let response = `📋 **Patient Medical Summary**\n\n`;
        
        if (contextData.patientInfo) {
            response += `**Patient:** ${contextData.patientInfo.name} (Age: ${contextData.patientInfo.age})\n`;
            response += `**ID:** ${contextData.patientInfo.patientId}\n\n`;
        }
        
        response += `**Current Medications (${contextData.totalMedications || 0}):**\n`;
        if (contextData.medications && contextData.medications.length > 0) {
            contextData.medications.forEach((med, index) => {
                response += `${index + 1}. ${med.name} ${med.dose} ${med.frequency}`;
                if (med.indication) response += ` - ${med.indication}`;
                response += `\n`;
            });
        } else {
            response += 'No medications currently prescribed.\n';
        }
        
        response += `\n**Known Allergies (${contextData.totalAllergies || 0}):**\n`;
        if (contextData.allergies && contextData.allergies.length > 0) {
            contextData.allergies.forEach((allergy, index) => {
                response += `${index + 1}. ${allergy.allergen}`;
                if (allergy.reaction) response += ` (${allergy.reaction})`;
                if (allergy.severity) response += ` - ${allergy.severity}`;
                response += `\n`;
            });
        } else {
            response += 'No known allergies recorded.\n';
        }
        
        response += `\n*Last updated: ${new Date(contextData.lastUpdated).toLocaleString()}*`;
        
        return response;
    }

    formatMedicationResponse(medicationData, message) {
        if (!medicationData) return message || 'Medication added successfully.';
        
        let response = `✅ **Medication Added Successfully**\n\n`;
        response += `**Medication:** ${medicationData.name}\n`;
        response += `**Dose:** ${medicationData.dose}\n`;
        response += `**Frequency:** ${medicationData.frequency}\n`;
        if (medicationData.indication) {
            response += `**Indication:** ${medicationData.indication}\n`;
        }
        response += `**Start Date:** ${medicationData.startDate}\n`;
        response += `**ID:** ${medicationData.id}\n\n`;
        
        response += `The medication has been added to the patient's current medication list. Please ensure to monitor for effectiveness and any potential side effects.`;
        
        return response;
    }

    formatDiscontinueResponse(medicationData, message) {
        if (!medicationData) return message || 'Medication discontinued successfully.';
        
        let response = `🛑 **Medication Discontinued**\n\n`;
        response += `**Medication:** ${medicationData.name}\n`;
        if (medicationData.dose) response += `**Dose:** ${medicationData.dose}\n`;
        if (medicationData.frequency) response += `**Frequency:** ${medicationData.frequency}\n`;
        
        response += `\nThe medication has been removed from the patient's active medication list.`;
        
        return response;
    }

    formatAllergyResponse(allergyData, message) {
        if (!allergyData) return message || 'Allergy added successfully.';
        
        let response = `⚠️ **Allergy Added to Patient Record**\n\n`;
        response += `**Allergen:** ${allergyData.allergen}\n`;
        if (allergyData.reaction) response += `**Reaction:** ${allergyData.reaction}\n`;
        if (allergyData.severity) response += `**Severity:** ${allergyData.severity}\n`;
        
        response += `\nThis allergy has been added to the patient's medical record and will be checked against future medication prescriptions.`;
        
        return response;
    }

    // Legacy methods - kept for compatibility but no longer used in main flow
    async generateOzwellFollowUp(toolName, result) {
        // This method is no longer used since we format responses directly
        console.log('generateOzwellFollowUp called but skipped - using direct MCP responses');
    }

    async generateOzwellErrorResponse(toolName, error) {
        // This method is no longer used since we format error responses directly
        console.log('generateOzwellErrorResponse called but skipped - using direct MCP error handling');
    }

    showHelp() {
        this.addSystemMessage(`
            🏥 **Medical AI Assistant Help**
            
            **What I can do:**
            • Add medications (e.g., "Add aspirin 81mg once daily for heart protection")
            • Show patient information (e.g., "Show current medications")
            • Add allergies (e.g., "Add allergy to penicillin causes rash")
            • Discontinue medications (e.g., "Stop aspirin")
            
            **Commands:**
            • /test-tools - Test available MCP tools
            • /help - Show this help message
            • Ctrl+T - Test available tools
            • Ctrl+R - Refresh connections
            • Ctrl+L - Clear chat
            • Ctrl+E - Export chat
        `);
    }

    async initializeMCP() {
        try {
        //    this.mcpServer = await new MedicalMCPServer().initialize();
            // Use the global MCP Server instance instead of creating a new one
            // Wait for the global server to be ready
            const waitForServer = () => {
                return new Promise((resolve) => {
                    const checkServer = () => {
                        if (window.medicationServer) {
                            resolve(window.medicationServer);
                        } else {
                            setTimeout(checkServer, 100);
                        }
                    };
                    checkServer();
                });
            };
            
            this.mcpServer = await waitForServer();
            this.updateStatus('connected', 'Connected to medical system');
            
            this.addSystemMessage('🔗 Connected to medical system');
            this.addSystemMessage('💬 I can help you with medical tasks like adding medications, managing allergies, and viewing patient information. Just tell me what you need!');
            
            // Request tools from MCP server
            this.requestToolsFromMCPServer();
            
        } catch (error) {
            console.error('Failed to initialize MCP:', error);
            this.updateStatus('error', 'Failed to connect to medical system');
            this.addSystemMessage('❌ Failed to connect to medical system: ' + error.message);
        }
    }

    testAvailableTools() {
        console.log('*** Testing available tools ***');
        
        if (this.availableTools.length > 0) {
            this.addSystemMessage(`🔍 Available MCP Tools: ${this.availableTools.map(t => t.name).join(', ')}`);
            
            this.availableTools.forEach(tool => {
                console.log(`Tool: ${tool.name} - ${tool.description}`);
                this.addSystemMessage(`🛠️ ${tool.name}: ${tool.description}`);
            });
        } else {
            this.addSystemMessage('❌ No tools available from MCP Server');
        }
        
        if (this.ozwell && this.ozwell.getAvailableTools) {
            const ozwellTools = this.ozwell.getAvailableTools();
            this.addSystemMessage(`🔍 Ozwell tools: ${JSON.stringify(ozwellTools)}`);
        }
        
        // Test MCP Server directly
        this.testMCPServerDirectly();
    }

    async testMCPServerDirectly() {
        try {
            if (this.mcpServer) {
                this.addSystemMessage('🧪 Testing MCP Server directly...');
                
                // Test getContext
                const context = this.mcpServer.getLocalContext();
                this.addSystemMessage(`📋 Current context: ${context.totalMedications} medications, ${context.totalAllergies} allergies`);
                
                // Test adding a medication
                const testMed = {
                    name: "Test Aspirin",
                    dose: "81mg",
                    frequency: "once daily",
                    indication: "Test medication"
                };
                
                const result = await this.mcpServer.executeTool('addMedication', testMed);
                this.addSystemMessage(`🧪 Test medication add result: ${JSON.stringify(result)}`);
                
            } else {
                this.addSystemMessage('❌ MCP Server not initialized for direct testing');
            }
        } catch (error) {
            this.addSystemMessage(`❌ MCP Server direct test failed: ${error.message}`);
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
            context: this.context,
            availableTools: this.availableTools
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

    analyzeMessageForToolAction(message) {
        const msg = message.toLowerCase().trim();
        
        // Check for medication-related requests
        if (this.isMedicationRequest(msg)) {
            return this.extractMedicationAction(msg, message);
        }
        
        // Check for allergy-related requests
        if (this.isAllergyRequest(msg)) {
            return this.extractAllergyAction(msg, message);
        }
        
        // Check for context/information requests
        if (this.isContextRequest(msg)) {
            return {
                toolName: 'getContext',
                parameters: {},
                description: 'Retrieving patient medical information'
            };
        }
        
        // Check for discontinue/stop medication requests
        if (this.isDiscontinueRequest(msg)) {
            return this.extractDiscontinueAction(msg, message);
        }
        
        // Return null if no specific action is detected
        return null;
    }

    isMedicationRequest(msg) {
        const addKeywords = ['add', 'prescribe', 'start', 'give', 'put on', 'begin', 'initiate'];
        const medicationKeywords = ['medication', 'med', 'drug', 'prescription', 'pill', 'tablet', 'capsule'];
        const specificMeds = ['aspirin', 'tylenol', 'ibuprofen', 'acetaminophen', 'paracetamol', 'lisinopril', 'metformin'];
        
        const hasAddKeyword = addKeywords.some(keyword => msg.includes(keyword));
        const hasMedicationKeyword = medicationKeywords.some(keyword => msg.includes(keyword)) || 
                                   specificMeds.some(med => msg.includes(med));
        const hasDosePattern = /\d+\s*(mg|mcg|g|ml|cc|units?)/i.test(msg);
        
        return (hasAddKeyword && hasMedicationKeyword) || hasDosePattern;
    }

    isAllergyRequest(msg) {
        const allergyKeywords = ['allergy', 'allergic', 'allergies', 'reaction', 'sensitive'];
        const addKeywords = ['add', 'record', 'note', 'document'];
        
        return allergyKeywords.some(keyword => msg.includes(keyword)) && 
               addKeywords.some(keyword => msg.includes(keyword));
    }

    isContextRequest(msg) {
        const contextKeywords = ['show', 'display', 'list', 'what', 'current', 'status', 'information', 'summary', 'overview'];
        const targetKeywords = ['medications', 'meds', 'allergies', 'patient', 'medical', 'history', 'conditions'];
        
        return contextKeywords.some(keyword => msg.includes(keyword)) && 
               targetKeywords.some(keyword => msg.includes(keyword));
    }

    isDiscontinueRequest(msg) {
        const stopKeywords = ['stop', 'discontinue', 'remove', 'delete', 'cancel', 'end', 'quit'];
        const medicationKeywords = ['medication', 'med', 'drug', 'prescription'];
        
        return stopKeywords.some(keyword => msg.includes(keyword)) && 
               medicationKeywords.some(keyword => msg.includes(keyword));
    }

    extractMedicationAction(msg, originalMessage) {
        // Extract medication details from the message
        const medicationData = this.extractMedicationDetails(originalMessage);
        
        if (medicationData.name) {
            return {
                toolName: 'addMedication',
                parameters: medicationData,
                description: `Adding medication: ${medicationData.name} ${medicationData.dose} ${medicationData.frequency}`
            };
        }
        
        // If we can't extract specific details, ask for clarification by getting context first
        return {
            toolName: 'getContext',
            parameters: {},
            description: 'Getting patient context to assist with medication request'
        };
    }

    extractAllergyAction(msg, originalMessage) {
        const allergyData = this.extractAllergyDetails(originalMessage);
        
        if (allergyData.allergen) {
            return {
                toolName: 'addAllergy',
                parameters: allergyData,
                description: `Adding allergy: ${allergyData.allergen}`
            };
        }
        
        return null;
    }

    extractDiscontinueAction(msg, originalMessage) {
        // Extract medication name or ID to discontinue
        const medicationId = this.extractMedicationName(originalMessage);
        
        if (medicationId) {
            return {
                toolName: 'discontinueMedication',
                parameters: { medId: medicationId },
                description: `Discontinuing medication: ${medicationId}`
            };
        }
        
        return null;
    }

    extractMedicationDetails(message) {
        const details = {
            name: '',
            dose: '',
            frequency: '',
            indication: ''
        };
        
        // Extract medication name (simple patterns)
        const medicationPatterns = [
            /(?:add|prescribe|start|give)\s+(\w+)/i,
            /(aspirin|tylenol|ibuprofen|acetaminophen|paracetamol|lisinopril|metformin|dolo)/i,
            /(\w+)\s+\d+\s*(?:mg|mcg|g|ml)/i
        ];
        
        for (const pattern of medicationPatterns) {
            const match = message.match(pattern);
            if (match) {
                details.name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                break;
            }
        }
        
        // Extract dose
        const doseMatch = message.match(/(\d+\s*(?:mg|mcg|g|ml|cc|units?))/i);
        if (doseMatch) {
            details.dose = doseMatch[1];
        }
        
        // Extract frequency
        const frequencyPatterns = [
            /(once\s+daily|twice\s+daily|three\s+times\s+daily|four\s+times\s+daily)/i,
            /(daily|bid|tid|qid|q\d+h)/i,
            /(every\s+\d+\s+hours?)/i,
            /(as\s+needed|prn)/i
        ];
        
        for (const pattern of frequencyPatterns) {
            const match = message.match(pattern);
            if (match) {
                details.frequency = match[1];
                break;
            }
        }
        
        // Extract indication/reason
        const indicationPatterns = [
            /for\s+(.+?)(?:\.|$)/i,
            /to\s+treat\s+(.+?)(?:\.|$)/i,
            /because\s+of\s+(.+?)(?:\.|$)/i
        ];
        
        for (const pattern of indicationPatterns) {
            const match = message.match(pattern);
            if (match) {
                details.indication = match[1].trim();
                break;
            }
        }
        
        return details;
    }

    extractAllergyDetails(message) {
        const details = {
            allergen: '',
            reaction: '',
            severity: 'Moderate'
        };
        
        // Extract allergen
        const allergenPatterns = [
            /allergic\s+to\s+(\w+)/i,
            /allergy\s+to\s+(\w+)/i,
            /add\s+allergy\s+(\w+)/i,
            /(penicillin|sulfa|shellfish|nuts|peanuts|latex)/i
        ];
        
        for (const pattern of allergenPatterns) {
            const match = message.match(pattern);
            if (match) {
                details.allergen = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                break;
            }
        }
        
        // Extract reaction type
        const reactionPatterns = [
            /causes?\s+(.+?)(?:\.|$)/i,
            /reaction\s+is\s+(.+?)(?:\.|$)/i,
            /(rash|hives|swelling|nausea|vomiting|difficulty breathing)/i
        ];
        
        for (const pattern of reactionPatterns) {
            const match = message.match(pattern);
            if (match) {
                details.reaction = match[1].trim();
                break;
            }
        }
        
        // Extract severity
        if (message.toLowerCase().includes('severe') || message.toLowerCase().includes('anaphylaxis')) {
            details.severity = 'Severe';
        } else if (message.toLowerCase().includes('mild') || message.toLowerCase().includes('minor')) {
            details.severity = 'Mild';
        }
        
        return details;
    }

    extractMedicationName(message) {
        // Extract medication name for discontinuation
        const patterns = [
            /(?:stop|discontinue|remove)\s+(\w+)/i,
            /(aspirin|tylenol|ibuprofen|acetaminophen|paracetamol|lisinopril|metformin)/i
        ];
        
        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            }
        }
        
        return null;
    }

    // ...existing code...
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mcpClient = new MCPClient();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            window.mcpClient.refreshConnection();
        }
        
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            window.mcpClient.clearChat();
        }
        
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            window.mcpClient.exportChat();
        }
        
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            window.mcpClient.testAvailableTools();
        }
    });
});