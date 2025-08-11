// Enhanced Ozwell Agent Simulator with API Integration
class OzwellAgentSimulator {
    constructor() {
        this.iframe = null;
        this.iframeContainer = null;
        this.isAgentActive = false;
        this.isExpanded = false;
        this.savedWidth = null;
        this.savedHeight = null;
        this.agentUrl = 'http://localhost:5173/agent-iframe/'; // Adjust as needed
        
        // Initialize Ozwell API handler
        this.ozwellHandler = new OzwellAPIHandler();
        
        this.initializeUI();
        this.setupMessageListener();
        this.addOzwellConfiguration();
        
        // Wait for environment variables to load
        this.initializeAsync();
    }

    async initializeAsync() {
        // Wait for environment variables to be loaded
        await this.ozwellHandler.loadEnvironmentVariables();
        console.log('Ozwell API Handler initialized with environment variables');
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

        // Create container for iframe with resize functionality
        this.iframeContainer = document.createElement('div');
        this.iframeContainer.style.cssText = `
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
            resize: both;
            overflow: hidden;
            min-width: 300px;
            min-height: 400px;
            max-width: 800px;
            max-height: 900px;
        `;

        // Create iframe element
        this.iframe = document.createElement('iframe');
        this.iframe.src = this.agentUrl;
        this.iframe.style.cssText = `
            width: 100%;
            height: calc(100% - 40px);
            border: none;
            border-radius: 0 0 8px 8px;
            background: white;
            margin-top: 40px;
        `;

        // Add header with title, expand/collapse, and close button
        const header = document.createElement('div');
        header.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 40px;
            background: #007bff;
            color: white;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 15px;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
            z-index: 1001;
            cursor: move;
            user-select: none;
        `;
        
        header.innerHTML = `
            <span>🏥 Ozwell Medical AI</span>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button id="expandCollapseBtn" onclick="window.ozwellAgent.toggleExpanded()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 3px;
                    transition: background-color 0.2s;
                " title="Expand/Collapse">⟐</button>
                <button onclick="window.ozwellAgent.closeAgent()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 2px 6px;
                    border-radius: 3px;
                    transition: background-color 0.2s;
                " title="Close">×</button>
            </div>
        `;

        // Add resize handle in the bottom-right corner
        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            background: linear-gradient(-45deg, transparent 40%, #007bff 40%, #007bff 60%, transparent 60%);
            cursor: nw-resize;
            z-index: 1002;
            border-radius: 0 0 8px 0;
        `;

        // Assemble the structure
        this.iframeContainer.appendChild(header);
        this.iframeContainer.appendChild(this.iframe);
        this.iframeContainer.appendChild(resizeHandle);
        document.body.appendChild(this.iframeContainer);

        // Store references for cleanup
        this.iframe._header = header;
        this.iframe._container = this.iframeContainer;
        this.iframe._resizeHandle = resizeHandle;

        // Add drag functionality to header
        this.makeDraggable(header, this.iframeContainer);
        
        // Add custom resize functionality
        this.makeResizable(resizeHandle, this.iframeContainer);

        // Add hover effects to buttons
        this.addButtonHoverEffects(header);

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
            if (this.iframe._container) {
                this.iframe._container.remove();
            } else {
                this.iframe.remove();
            }
            this.iframe = null;
            this.iframeContainer = null;
            this.isAgentActive = false;
            this.isExpanded = false;
            medicalDataManager.log("Agent iframe closed");
        }
    }

    // Make iframe draggable by header
    makeDraggable(header, container) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header) {
                isDragging = true;
                header.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                // Keep within viewport bounds
                const maxX = window.innerWidth - container.offsetWidth;
                const maxY = window.innerHeight - container.offsetHeight;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                container.style.left = currentX + 'px';
                container.style.top = currentY + 'px';
                container.style.right = 'auto';
                container.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        });
    }

    // Make iframe resizable using custom resize handle
    makeResizable(resizeHandle, container) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            e.preventDefault();

            const newWidth = startWidth + e.clientX - startX;
            const newHeight = startHeight + e.clientY - startY;

            // Apply constraints
            const minWidth = 300;
            const minHeight = 400;
            const maxWidth = 800;
            const maxHeight = 900;

            const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

            container.style.width = constrainedWidth + 'px';
            container.style.height = constrainedHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    // Add hover effects to header buttons
    addButtonHoverEffects(header) {
        const buttons = header.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = 'transparent';
            });
        });
    }

    // Toggle expanded/collapsed state
    toggleExpanded() {
        if (!this.iframeContainer) return;

        this.isExpanded = !this.isExpanded;
        const expandBtn = document.getElementById('expandCollapseBtn');
        
        if (this.isExpanded) {
            // Save current size
            this.savedWidth = this.iframeContainer.style.width;
            this.savedHeight = this.iframeContainer.style.height;
            
            // Expand to larger size
            this.iframeContainer.style.width = '800px';
            this.iframeContainer.style.height = '900px';
            expandBtn.innerHTML = '⟝';
            expandBtn.title = 'Collapse';
            medicalDataManager.log("Agent iframe expanded");
        } else {
            // Restore saved size or default
            this.iframeContainer.style.width = this.savedWidth || '400px';
            this.iframeContainer.style.height = this.savedHeight || '600px';
            expandBtn.innerHTML = '⟐';
            expandBtn.title = 'Expand';
            medicalDataManager.log("Agent iframe collapsed");
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
        this.apiKey = null; // Will be loaded from .env file
        this.baseUrl = 'https://ai.bluehive.com/api/v1/completion';
        this.defaultModel = 'ozwell-medical-v1';
        this.envLoaded = false;
        
        // Note: loadEnvironmentVariables() will be called from initializeAsync()
    }

    // Load environment variables from .env file
    async loadEnvironmentVariables() {
        try {
            const response = await fetch('../.env');
            if (!response.ok) {
                console.warn('Could not load .env file, using fallback configuration');
                this.apiKey = 'BHSK-sandbox-GxuFjWNW1lSvP-t9XStZyLWxMBZGQF9dhCHzrIXk'; // fallback
                return;
            }
            
            const envContent = await response.text();
            const envVars = this.parseEnvFile(envContent);
            
            if (envVars.OZWELL_API_KEY) {
                this.apiKey = envVars.OZWELL_API_KEY;
                console.log('API key loaded from .env file');
            } else {
                console.warn('OZWELL_API_KEY not found in .env file, using fallback');
                this.apiKey = 'BHSK-sandbox-GxuFjWNW1lSvP-t9XStZyLWxMBZGQF9dhCHzrIXk'; // fallback
            }
            
            // Load other environment variables if available
            if (envVars.OZWELL_BASE_URL) {
                this.baseUrl = envVars.OZWELL_BASE_URL;
            }
            if (envVars.OZWELL_MODEL) {
                this.defaultModel = envVars.OZWELL_MODEL;
            }
            
        } catch (error) {
            console.error('Error loading environment variables:', error);
            console.warn('Using fallback configuration');
            this.apiKey = 'BHSK-sandbox-GxuFjWNW1lSvP-t9XStZyLWxMBZGQF9dhCHzrIXk'; // fallback
        }
    }

    // Parse .env file content
    parseEnvFile(content) {
        const envVars = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }
            
            // Parse KEY=VALUE or KEY='VALUE' or KEY="VALUE"
            const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
            if (match) {
                const [, key, value] = match;
                
                // Remove quotes if present
                let cleanValue = value.trim();
                if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
                    (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
                    cleanValue = cleanValue.slice(1, -1);
                }
                
                envVars[key] = cleanValue;
            }
        }
        
        return envVars;
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