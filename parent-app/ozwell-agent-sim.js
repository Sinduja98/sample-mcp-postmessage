// Enhanced Ozwell Agent Simulator with API Integration
class OzwellAgentSimulator {
    constructor() {
        this.iframe = null;
        this.isAgentActive = false;
        this.agentUrl = 'http://localhost:5173/agent-iframe/'; // Adjust as needed
        
        // Initialize Ozwell API handler
        this.ozwellHandler = new OzwellAPIHandler();
        
        this.initializeUI();
        this.setupMessageListener();
        this.addOzwellConfiguration();
    }

    initializeUI() {
        // Add event listeners to existing buttons
        document.getElementById('runSimulation').addEventListener('click', () => {
            this.runSimulation();
        });

        document.getElementById('showContext').addEventListener('click', () => {
            this.showCurrentContext();
        });
    }

    addOzwellConfiguration() {
        // Add Ozwell configuration section to the UI
        const configSection = document.createElement('div');
        configSection.innerHTML = `
            <div style="margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
                <h3>Ozwell API Configuration</h3>
                <div style="margin: 10px 0;">
                    <label>API Key: </label>
                    <input type="password" id="ozwellApiKey" placeholder="Enter Ozwell API Key" style="width: 300px; margin: 5px;">
                </div>
                <div style="margin: 10px 0;">
                    <label>API URL: </label>
                    <input type="text" id="ozwellApiUrl" placeholder="https://ai.bluehive.com/api/v1/completion" style="width: 300px; margin: 5px;">
                </div>
                <div style="margin: 10px 0;">
                    <label>Model: </label>
                    <input type="text" id="ozwellModel" placeholder="ozwell-medical-v1" style="width: 300px; margin: 5px;">
                </div>
                <div style="margin: 10px 0;">
                    <button id="saveOzwellConfig" style="padding: 8px 16px; margin-right: 10px;">Save Configuration</button>
                    <button id="testOzwellConnection" style="padding: 8px 16px;">Test Connection</button>
                    <span id="ozwellStatus" style="margin-left: 10px; font-weight: bold;"></span>
                </div>
            </div>
        `;
        
        // Insert after the existing controls
        const existingControls = document.querySelector('.controls') || document.body;
        existingControls.insertAdjacentElement('afterend', configSection);

        // Add event listeners for configuration
        document.getElementById('saveOzwellConfig').addEventListener('click', () => {
            this.saveOzwellConfiguration();
        });

        document.getElementById('testOzwellConnection').addEventListener('click', () => {
            this.testOzwellConnection();
        });

        // Load saved configuration
        this.loadSavedConfiguration();
    }

    loadSavedConfiguration() {
        const apiKey = localStorage.getItem('ozwell_api_key') || '';
        const apiUrl = localStorage.getItem('ozwell_api_url') || 'https://ai.bluehive.com/api/v1/completion';
        const model = localStorage.getItem('ozwell_model') || 'ozwell-medical-v1';

        document.getElementById('ozwellApiKey').value = apiKey;
        document.getElementById('ozwellApiUrl').value = apiUrl;
        document.getElementById('ozwellModel').value = model;

        if (apiKey) {
            this.ozwellHandler.handleConfiguration({
                apiKey: apiKey,
                baseUrl: apiUrl,
                model: model
            });
        }
    }

    saveOzwellConfiguration() {
        const apiKey = document.getElementById('ozwellApiKey').value.trim();
        const apiUrl = document.getElementById('ozwellApiUrl').value.trim();
        const model = document.getElementById('ozwellModel').value.trim();

        if (!apiKey) {
            this.updateOzwellStatus('Please enter an API key', 'error');
            return;
        }

        // Save to localStorage
        localStorage.setItem('ozwell_api_key', apiKey);
        localStorage.setItem('ozwell_api_url', apiUrl);
        localStorage.setItem('ozwell_model', model);

        // Configure the handler
        this.ozwellHandler.handleConfiguration({
            apiKey: apiKey,
            baseUrl: apiUrl || 'https://ai.bluehive.com/api/v1/completion',
            model: model || 'ozwell-medical-v1'
        });

        this.updateOzwellStatus('Configuration saved successfully', 'success');
        medicalDataManager.log('Ozwell configuration saved', { apiUrl, model, hasApiKey: !!apiKey });
    }

    async testOzwellConnection() {
        try {
            this.updateOzwellStatus('Testing connection...', 'info');
            
            const result = await this.ozwellHandler.testConnection();
            this.updateOzwellStatus('Connection successful!', 'success');
            medicalDataManager.log('Ozwell connection test successful', result);
        } catch (error) {
            this.updateOzwellStatus(`Connection failed: ${error.message}`, 'error');
            medicalDataManager.log('Ozwell connection test failed', { error: error.message });
        }
    }

    updateOzwellStatus(message, type = 'info') {
        const statusElement = document.getElementById('ozwellStatus');
        statusElement.textContent = message;
        
        // Remove previous classes
        statusElement.className = '';
        
        // Add appropriate class based on type
        switch (type) {
            case 'success':
                statusElement.style.color = '#28a745';
                break;
            case 'error':
                statusElement.style.color = '#dc3545';
                break;
            case 'info':
                statusElement.style.color = '#17a2b8';
                break;
            default:
                statusElement.style.color = '#333';
        }
    }

    setupMessageListener() {
        window.addEventListener('message', async (event) => {
            console.log("Received message:", event.data);
            
            // Note: MCP requests are now handled directly by MedicalDataManager
            // This class now only handles Ozwell API requests and tools context
            
            // Handle request for tools context from iframe
            if (event.data.type === 'request-tools-context') {
                console.log('*** Iframe requested tools context ***');
                medicalDataManager.log('Iframe requested tools context');
                this.sendToolsContext();
            }
            
            // Handle Ozwell API requests
            else if (event.data.type === 'ozwell-request') {
                await this.ozwellHandler.handleOzwellRequest(event);
            }
            
            // Handle Ozwell configuration
            else if (event.data.type === 'ozwell-config') {
                this.ozwellHandler.handleConfiguration(event.data.config);
            }
        });
    }

    createAgentIframe() {
        if (this.iframe) {
            return; // Already exists
        }

        medicalDataManager.log("Creating agent iframe...");

        // Create iframe element
        this.iframe = document.createElement('iframe');
        this.iframe.src = this.agentUrl;
        this.iframe.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            height: 600px;
            border: 2px solid #007bff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            background: white;
        `;

        // Add header with title and close button
        const header = document.createElement('div');
        header.style.cssText = `
            position: absolute;
            top: -40px;
            left: 0;
            right: 0;
            height: 30px;
            background: #007bff;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
            z-index: 1001;
        `;
        header.innerHTML = `
            <span>Ozwell Medical AI</span>
            <button onclick="window.ozwellAgent.closeAgent()" style="
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
            ">×</button>
        `;

        document.body.appendChild(header);
        document.body.appendChild(this.iframe);

        // Store reference to header for cleanup
        this.iframe._header = header;

        // Wait for iframe to load, then initialize
        this.iframe.onload = () => {
            this.isAgentActive = true;
            // Send initial context and tools context
            this.sendInitialContext();
        };
    }

    closeAgent() {
        if (this.iframe) {
            if (this.iframe._header) {
                this.iframe._header.remove();
            }
            this.iframe.remove();
            this.iframe = null;
            this.isAgentActive = false;
            medicalDataManager.log("Agent iframe closed");
        }
    }

    sendInitialContext() {
        if (!this.iframe) return;

        const context = getContext();
        
        // Send both regular context and tools context
        this.iframe.contentWindow.postMessage({
            type: 'mcp-context',
            context: context
        }, '*');

        // Also send tools context immediately
        this.sendToolsContext();

        medicalDataManager.log("Initial context and tools context sent to agent");
    }

    sendToolsContext() {
        if (!this.iframe) return;

        // Define the tools context from parent (where tools are actually implemented)
        const toolsContext = {
            availableTools: [
                {
                    name: 'getContext',
                    description: 'Retrieve current patient medical information',
                    parameters: {},
                    implementation: 'Available via MCP server'
                },
                {
                    name: 'addMedication',
                    description: 'Add a new medication to patient records',
                    parameters: {
                        name: 'string - Name of the medication',
                        dose: 'string - Dosage amount (e.g., "500mg")',
                        frequency: 'string - How often to take (e.g., "twice daily")',
                        indication: 'string - Reason for prescribing'
                    },
                    implementation: 'Available via MCP server'
                },
                {
                    name: 'discontinueMedication',
                    description: 'Discontinue an existing medication',
                    parameters: {
                        medId: 'string - Name or ID of medication to discontinue'
                    },
                    implementation: 'Available via MCP server'
                },
                {
                    name: 'addAllergy',
                    description: 'Add a new allergy to patient records',
                    parameters: {
                        allergen: 'string - The substance the patient is allergic to',
                        reaction: 'string - The type of reaction experienced',
                        severity: 'string - Severity level: "Mild", "Moderate", or "Severe"'
                    },
                    implementation: 'Available via MCP server'
                }
            ],
            currentContext: getContext().data, // Get current patient context
            sourceLocation: 'parent-app'
        };

        console.log('*** Parent app sending tools context to iframe ***', toolsContext);

        // Send tools context to iframe for Ozwell
        this.iframe.contentWindow.postMessage({
            type: 'mcp-tools-context',
            toolsContext: toolsContext
        }, '*');

        medicalDataManager.log("Tools context sent to iframe for Ozwell");
    }

    runSimulation() {
        medicalDataManager.log("Starting simulation...");
        
        // Create iframe if it doesn't exist
        if (!this.iframe) {
            this.createAgentIframe();
        }
    }

    showCurrentContext() {
        const context = getContext();
        const contextDisplay = document.getElementById('contextDisplay');
        const contextJson = document.getElementById('contextJson');
        
        contextJson.textContent = JSON.stringify(context.data, null, 2);
        contextDisplay.style.display = 'block';
    }

    // Method to manually send a message to the agent
    sendMessageToAgent(message) {
        if (!this.iframe) {
            this.createAgentIframe();
            // Wait for iframe to load before sending message
            setTimeout(() => {
                this.iframe.contentWindow.postMessage({
                    type: 'manual-message',
                    message: message
                }, '*');
            }, 2000);
        } else {
            this.iframe.contentWindow.postMessage({
                type: 'manual-message',
                message: message
            }, '*');
        }
    }
}

// Parent Window - Ozwell API Handler (Updated to work with existing structure)
class OzwellAPIHandler {
    constructor() {
        this.apiKey = 'Add API key here'; // In production, this should be securely managed
        this.baseUrl = 'https://ai.bluehive.com/api/v1/completion';
        this.defaultModel = 'ozwell-medical-v1';
    }

    handleConfiguration(config) {
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.model) this.defaultModel = config.model;
        
        console.log('Ozwell configuration updated:', { 
            hasApiKey: !!this.apiKey, 
            baseUrl: this.baseUrl, 
            model: this.defaultModel 
        });
    }

    async handleOzwellRequest(event) {
        const { requestId, payload } = event.data;
        const source = event.source;

        try {
            if (payload.stream) {
                await this.handleStreamingRequest(requestId, payload, source);
            } else {
                await this.handleNonStreamingRequest(requestId, payload, source);
            }
        } catch (error) {
            console.error('Error handling Ozwell request:', error);
            source.postMessage({
                type: 'ozwell-error',
                requestId: requestId,
                error: error.message
            }, '*');
        }
    }

    async handleNonStreamingRequest(requestId, payload, source) {
        // Convert messages to prompt format for Ozwell API
        const prompt = this.convertMessagesToPrompt(payload.messages);
        
        const requestBody = {
            model: payload.model || this.defaultModel,
            prompt: prompt,
            temperature: payload.temperature || 0.7,
            max_tokens: payload.max_tokens || 1000
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Full API response structure:', JSON.stringify(data, null, 2));
            
            // Extract response content with detailed logging
            let responseContent = '';
            if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
                const choice = data.choices[0];
                console.log('First choice structure:', JSON.stringify(choice, null, 2));
                
                if (choice.message && choice.message.content) {
                    responseContent = choice.message.content;
                    console.log('Using message.content:', responseContent);
                } else if (choice.text) {
                    responseContent = choice.text;
                    console.log('Using choice.text:', responseContent);
                }
            } else if (data.text) {
                responseContent = data.text;
                console.log('Using data.text:', responseContent);
            } else if (data.response) {
                responseContent = data.response;
                console.log('Using data.response:', responseContent);
            } else {
                // Log all fields for debugging
                console.log('Searching through all response fields:');
                for (const [key, value] of Object.entries(data)) {
                    console.log(`- ${key}:`, typeof value, value);
                }
                responseContent = JSON.stringify(data);
            }
            
            // Clean up response
            responseContent = responseContent.trim();
            if (responseContent.startsWith('Ozwell AI:')) {
                responseContent = responseContent.substring('Ozwell AI:'.length).trim();
            }
            
            // Update the response data with cleaned content
            if (data.choices && data.choices[0]) {
                if (data.choices[0].message) {
                    data.choices[0].message.content = responseContent;
                } else if (data.choices[0].text !== undefined) {
                    data.choices[0].text = responseContent;
                }
            }
            console.log('Final cleaned response content:', responseContent);
            
            source.postMessage({
                type: 'ozwell-response',
                requestId: requestId,
                success: true,
                response: data
            }, '*');

        } catch (error) {
            console.error('Ozwell API error:', error);
            source.postMessage({
                type: 'ozwell-response',
                requestId: requestId,
                success: false,
                error: error.message
            }, '*');
        }
    }

    async handleStreamingRequest(requestId, payload, source) {
        // Convert messages to prompt format for Ozwell API
        const prompt = this.convertMessagesToPrompt(payload.messages);
        
        const requestBody = {
            model: payload.model || this.defaultModel,
            prompt: prompt,
            temperature: payload.temperature || 0.7,
            max_tokens: payload.max_tokens || 1000,
            stream: true
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                source.postMessage({
                                    type: 'ozwell-stream-end',
                                    requestId: requestId
                                }, '*');
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                source.postMessage({
                                    type: 'ozwell-stream-chunk',
                                    requestId: requestId,
                                    chunk: parsed
                                }, '*');
                            } catch (e) {
                                console.warn('Failed to parse streaming chunk:', e);
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

        } catch (error) {
            console.error('Ozwell streaming API error:', error);
            source.postMessage({
                type: 'ozwell-error',
                requestId: requestId,
                error: error.message
            }, '*');
        }
    }

    async testConnection() {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        // Convert test message to prompt format with better test message
        const testMessages = [{ role: 'user', content: 'Hello, please introduce yourself as a medical AI assistant.' }];
        const prompt = this.convertMessagesToPrompt(testMessages);

        const testPayload = {
            model: this.defaultModel,
            prompt: prompt,
            max_tokens: 50,
            temperature: 0.7
        };

        console.log('Testing connection with payload:', JSON.stringify(testPayload, null, 2));

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(testPayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Test connection error response:', errorText);
            throw new Error(`Connection test failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
        }

        const data = await response.json();
        return data;
    }

    // Helper method to convert OpenAI-style messages to a single prompt string
    convertMessagesToPrompt(messages) {
        let prompt = '';
        
        // Start with a clear medical AI context
        prompt += 'You are Ozwell, a professional medical AI assistant. You help healthcare providers with patient care by providing medical information, medication management, and clinical decision support.\n\n';
        
        for (const message of messages) {
            switch (message.role) {
                case 'system':
                    // Skip system messages that are already included in our context
                    if (!message.content.toLowerCase().includes('medical ai assistant') && 
                        !message.content.toLowerCase().includes('ozwell')) {
                        prompt += `System: ${message.content}\n\n`;
                    }
                    break;
                case 'user':
                    prompt += `Healthcare Provider: ${message.content}\n\n`;
                    break;
                case 'assistant':
                    prompt += `Ozwell AI: ${message.content}\n\n`;
                    break;
                default:
                    prompt += `${message.content}\n\n`;
            }
        }
        
        // Add a clear prompt for the assistant to respond as a medical AI
        prompt += 'Ozwell AI:';
        
        console.log('Generated prompt for API:');
        console.log('========================');
        console.log(prompt);
        console.log('========================');
        return prompt;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ozwellAgent = new OzwellAgentSimulator();
});