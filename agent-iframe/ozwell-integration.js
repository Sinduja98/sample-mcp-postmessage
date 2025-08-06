// Ozwell AI Integration for MCP Client - Updated for Real API
class OzwellIntegration {
    constructor() {
        this.apiKey = 'Add API key here'; // In production, this should be securely managed
        this.baseUrl = 'https://ai.bluehive.com/api/v1/completion'; // Adjust to actual Ozwell API endpoint
        this.model = 'ozwell-medical-v1'; // Adjust to actual model name
        
        // Force simulation mode for now to ensure MCP tools work
        this.useSimulationMode = true;
        console.log('Ozwell Integration initialized in simulation mode for MCP tool compatibility');
        
        this.systemPrompt = `You are Ozwell, a medical AI assistant integrated with a medical practice management system. You have access to the following tools:

AVAILABLE TOOLS:
- getContext(): Retrieve current patient medical information
- addMedication(medication): Add a new medication (requires: name, dose, frequency, indication)
- discontinueMedication(medication): Remove a medication from patient's list
- addAllergy(allergy): Add a new allergy (requires: allergen, reaction, severity)

IMPORTANT GUIDELINES:
- ALWAYS use getContext() first if you don't have current patient information
- For medication requests, extract medication details and add them using appropriate tools
- Use standard medication names and dosages (e.g., "Dolo 650" = "Paracetamol 650mg")
- Be proactive and use tools rather than asking for more information when details are clear
- Provide brief, professional responses after tool execution

MEDICATION EXAMPLES:
- "dolo650" or "dolo 650" = Paracetamol 650mg for pain/fever
- Common dosing: 650mg every 6-8 hours as needed, max 3000mg/day

When you need to use a tool, format your response with:
TOOL_CALL: {toolName}
PARAMS: {parameters as JSON}

For example:
TOOL_CALL: addMedication
PARAMS: {"name": "Paracetamol", "dose": "650mg", "frequency": "every 6-8 hours as needed", "indication": "Pain and fever relief"}
`;
    }

    async generateResponse(messages, onChunk = null) {
        console.log('*** generateResponse called with useSimulationMode:', this.useSimulationMode);
        console.log('*** Last message:', messages[messages.length - 1]?.content);
        
        // If we've determined that simulation mode should be used, skip API call
        if (this.useSimulationMode) {
            console.log('*** Using simulation mode (forced for MCP compatibility) ***');
            const simulationResult = await this.simulateOzwellAPI(messages);
            console.log('*** Simulation result:', simulationResult);
            return simulationResult;
        }

        try {
            console.log('*** Attempting real API call ***');
            // Call real Ozwell API
            const response = await this.callOzwellAPI(messages, onChunk);
            console.log('*** Real API response:', response);
            return response;
        } catch (error) {
            console.error('Ozwell API Error:', error);
            
            // If this is a 400 error, it likely means the API endpoint is incorrect
            // Set simulation mode for future calls to avoid repeated failures
            // if (error.message.includes('400')) {
            //     console.log('Setting simulation mode due to 400 error - API endpoint likely incorrect');
            //     this.useSimulationMode = true;
            // }
            
            // Fallback to simulated response if API fails
            // console.log('Falling back to simulated response...');
            // return await this.simulateOzwellAPI(messages);
        }
    }

    async callOzwellAPI(messages, onChunk = null) {
        // Prepare the conversation history for Ozwell
        const conversationMessages = [
            {
                role: 'system',
                content: this.systemPrompt
            },
            ...messages
        ];

        // Convert messages to a single prompt string for Ozwell API
        const prompt = this.convertMessagesToPrompt(conversationMessages);

        // Ozwell API expects a "prompt" field instead of "messages"
        const requestBody = {
            // model: this.model,
            prompt: prompt,
            temperature: 0.7,
            max_tokens: 1000,
            stream: !!onChunk // Enable streaming if callback provided
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
            // Add any other required headers for Ozwell API
        };

        if (onChunk) {
            // Handle streaming response
            return await this.handleStreamingResponse(requestBody, headers, onChunk);
        } else {
            // Handle non-streaming response
            return await this.handleNonStreamingResponse(requestBody, headers);
        }
    }

    async handleStreamingResponse(requestBody, headers, onChunk) {
        // console.log('Making streaming API request to:', this.baseUrl);
        // console.log('Request body:', JSON.stringify(requestBody, null, 2));
        // console.log('Headers:', headers);
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Streaming response status:', response.status);
        console.log('Streaming response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                console.log('Raw chunk received:', JSON.stringify(chunk));
                
                buffer += chunk;
                const lines = buffer.split('\n');
                
                // Keep the last line in buffer in case it's incomplete
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    console.log('Processing line:', JSON.stringify(trimmedLine));
                    
                    let content = '';
                    
                    // Handle Server-Sent Events format
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6);
                        if (data === '[DONE]') {
                            console.log('Received [DONE] signal');
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            content = this.extractContentFromStreamChunk(parsed);
                        } catch (e) {
                            console.warn('Failed to parse SSE JSON chunk:', e, 'Data:', data);
                            // Treat as plain text if not JSON
                            content = data;
                        }
                    }
                    // Handle raw JSON streaming (one JSON object per line)
                    else if (trimmedLine.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(trimmedLine);
                            content = this.extractContentFromStreamChunk(parsed);
                        } catch (e) {
                            console.warn('Failed to parse JSON line:', e, 'Line:', trimmedLine);
                        }
                    }
                    // Handle plain text streaming
                    else {
                        console.log('Treating as plain text chunk:', trimmedLine);
                        content = trimmedLine;
                    }
                    
                    if (content) {
                        console.log('Extracted content:', JSON.stringify(content));
                        fullResponse += content;
                        onChunk(content);
                    }
                }
            }
            
            // Process any remaining content in buffer
            if (buffer.trim()) {
                console.log('Processing remaining buffer:', JSON.stringify(buffer));
                let content = '';
                
                if (buffer.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(buffer.trim());
                        content = this.extractContentFromStreamChunk(parsed);
                    } catch (e) {
                        console.warn('Failed to parse final buffer JSON:', e);
                        content = buffer.trim();
                    }
                } else {
                    content = buffer.trim();
                }
                
                if (content) {
                    console.log('Final buffer content:', JSON.stringify(content));
                    fullResponse += content;
                    onChunk(content);
                }
            }
            
        } finally {
            reader.releaseLock();
        }

        console.log('Final streaming response:', JSON.stringify(fullResponse));
        return fullResponse;
    }

    extractContentFromStreamChunk(parsed) {
        // Handle different streaming response formats
        let content = '';
        
        console.log('Extracting content from chunk:', JSON.stringify(parsed));
        
     if (parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content) {
            content = parsed.choices[0].message.content;
            console.log('Using Ozwell-style response content:', content);
        } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].text) {
            // Completion-style streaming
            content = parsed.choices[0].text;
            console.log('Using completion-style text:', content);
        } else if (parsed.text) {
            // Simple text streaming
            content = parsed.text;
            console.log('Using simple text:', content);
        } else if (parsed.token) {
            // Token-based streaming
            content = parsed.token;
            console.log('Using token:', content);
        } else if (parsed.content) {
            // Content field
            content = parsed.content;
            console.log('Using content field:', content);
        } else if (parsed.response) {
            // Response field
            content = parsed.response;
            console.log('Using response field:', content);
        } else if (parsed.completion) {
            // Completion field
            content = parsed.completion;
            console.log('Using completion field:', content);
        } else if (typeof parsed === 'string') {
            // Direct string
            content = parsed;
            console.log('Using direct string:', content);
        } else {
            // Look for any string field that might contain the response
            console.log('Searching for content in all fields:', Object.keys(parsed));
            for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'string' && value.trim().length > 0) {
                    console.log(`Found potential content in ${key}:`, value);
                    if (!content) content = value;
                }
            }
        }
        
        return content;
    }

    async handleNonStreamingResponse(requestBody, headers) {
        console.log('Making API request to:', this.baseUrl);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        console.log('Headers:', headers);
        
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            // Try to get more details about the error
            let errorText = '';
            try {
                errorText = await response.text();
                console.log('Error response body:', errorText);
            } catch (e) {
                console.log('Could not read error response body');
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText ? 'Details: ' + errorText : ''}`);
        }

        const data = await response.json();
        console.log('Full API response structure:', JSON.stringify(data, null, 2));
        
        // Handle different response formats that Ozwell might use
        let responseText = '';
        
        if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
            const choice = data.choices[0];
            console.log('First choice structure:', JSON.stringify(choice, null, 2));
            
            if (choice.message && choice.message.content) {
                // OpenAI-style response
                responseText = choice.message.content;
                console.log('Using message.content:', responseText);
            } else if (choice.text) {
                // Completion-style response
                responseText = choice.text;
                console.log('Using choice.text:', responseText);
            }
        } else if (data.text) {
            // Simple text response
            responseText = data.text;
            console.log('Using data.text:', responseText);
        } else if (data.response) {
            // Response in a 'response' field
            responseText = data.response;
            console.log('Using data.response:', responseText);
        } else if (data.completion) {
            // Response in a 'completion' field
            responseText = data.completion;
            console.log('Using data.completion:', responseText);
        } else if (data.content) {
            // Response in a 'content' field
            responseText = data.content;
            console.log('Using data.content:', responseText);
        } else if (typeof data === 'string') {
            // Direct string response
            responseText = data;
            console.log('Using direct string:', responseText);
        } else {
            // Log all possible fields for debugging
            console.log('Searching through all response fields:');
            console.log('Response data type:', typeof data);
            console.log('Response data keys:', Object.keys(data));
            
            for (const [key, value] of Object.entries(data)) {
                console.log(`- ${key}:`, typeof value, value);
                
                // Try to find text-like content in any field
                if (typeof value === 'string' && value.trim().length > 0) {
                    console.log(`Found potential response text in ${key}:`, value);
                    if (!responseText) responseText = value;
                }
                
                // Also check if it's an object with text content
                if (typeof value === 'object' && value !== null) {
                    for (const [subKey, subValue] of Object.entries(value)) {
                        if (typeof subValue === 'string' && subValue.trim().length > 0) {
                            console.log(`Found potential response text in ${key}.${subKey}:`, subValue);
                            if (!responseText) responseText = subValue;
                        }
                    }
                }
            }
            
            if (!responseText) {
                console.log('No recognizable response format, using JSON string');
                responseText = JSON.stringify(data);
            }
        }
        
        // Clean up the response text
        responseText = responseText.trim();
        console.log('Raw response text after cleanup:', responseText);
        
        // Remove any "Ozwell AI:" prefix if it's duplicated
        if (responseText.startsWith('Ozwell AI:')) {
            responseText = responseText.substring('Ozwell AI:'.length).trim();
            console.log('Removed Ozwell AI prefix:', responseText);
        }
        
        // If the response is too short or seems incomplete, provide a fallback
        if (!responseText || responseText.length < 2) {
            console.warn('Received empty or very short response from API');
            console.log('Empty response debug info:');
            console.log('- responseText value:', JSON.stringify(responseText));
            console.log('- responseText length:', responseText ? responseText.length : 0);
            console.log('- Original API response:', JSON.stringify(data));
            
            // Try one more time to extract any text from the response
            const jsonStr = JSON.stringify(data);
            if (jsonStr.includes('"') && jsonStr.length > 10) {
                console.log('Trying to extract text from JSON structure...');
                // Look for any quoted strings that might be the response
                const textMatches = jsonStr.match(/"([^"]{10,})"/g);
                if (textMatches && textMatches.length > 0) {
                    for (const match of textMatches) {
                        const text = match.slice(1, -1); // Remove quotes
                        if (!text.includes('model') && !text.includes('Bearer') && !text.includes('http')) {
                            console.log('Found potential response in JSON:', text);
                            responseText = text;
                            break;
                        }
                    }
                }
            }
            
            // Final fallback
            if (!responseText || responseText.length < 2) {
                responseText = 'Hello! I\'m Ozwell, your medical AI assistant. I received your message but had trouble processing the response. How can I help you with your medical needs today?';
            }
        }
        
        console.log('Final processed response text:', responseText);
        return responseText;
    }

    // Keep the existing simulation methods as fallback
    async simulateOzwellAPI(messages) {
        // Get the last message from the user
        const lastMessage = messages[messages.length - 1]?.content || '';
        const msg = lastMessage.toLowerCase();
        console.log('*** Simulating response for:', msg);
        console.log('*** Current system prompt includes tools:', this.systemPrompt.includes('TOOL_CALL:'));

        // Check if we have tools context - if not, we need context first
        if (!this.toolsContext || !this.toolsContext.availableTools) {
            console.log('*** No tools context available, requesting context first ***');
            return `I need to connect to the medical system first. Let me get the current patient information.

TOOL_CALL: getContext
PARAMS: {}`;
        }

        // Now we have tools context, process the request intelligently
        console.log('*** Processing request with available tools ***');

        // Check for medication-related requests
        if (msg.includes('prescribe') || msg.includes('add') || msg.includes('give') || 
            (msg.includes('dolo') && (msg.includes('650') || msg.includes('paracetamol')))) {
            
            console.log('*** Detected medication request ***');
            
            // Extract medication information intelligently
            let medicationName = '';
            let dose = '';
            let frequency = 'as needed';
            let indication = '';

            if (msg.includes('dolo') && msg.includes('650')) {
                medicationName = 'Paracetamol';
                dose = '650mg';
                frequency = 'every 6-8 hours as needed';
                indication = 'Pain and fever relief';
            } else if (msg.includes('paracetamol')) {
                medicationName = 'Paracetamol';
                dose = msg.includes('650') ? '650mg' : '500mg';
                frequency = 'every 6-8 hours as needed';
                indication = 'Pain and fever relief';
            } else {
                // Default for unspecified medication
                medicationName = 'Paracetamol';
                dose = '650mg';
                frequency = 'every 6-8 hours as needed';
                indication = 'Pain and fever relief';
            }

            return `I'll add ${medicationName} ${dose} to the patient's medication list.

TOOL_CALL: addMedication
PARAMS: {"name": "${medicationName}", "dose": "${dose}", "frequency": "${frequency}", "indication": "${indication}"}`;
        }

        // Check for allergy-related requests
        if (msg.includes('allergy') || msg.includes('allergic')) {
            console.log('*** Detected allergy request ***');
            return `I'll help you add an allergy to the patient's profile. Let me first check their current information.

TOOL_CALL: getContext
PARAMS: {}`;
        }

        // Check for context/information requests
        if (msg.includes('context') || msg.includes('patient') || msg.includes('information') || 
            msg.includes('show') || msg.includes('current')) {
            console.log('*** Detected context request ***');
            return `I'll retrieve the current patient information for you.

TOOL_CALL: getContext
PARAMS: {}`;
        }

        // For any other medical request, get context first for safety
        console.log('*** General medical request - getting context for safety ***');
        return `I'll help you with that. Let me first check the patient's current medical information to provide the safest and most appropriate care.

TOOL_CALL: getContext
PARAMS: {}`;
    }

    parseToolCalls(response) {
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
            return [{
                name: toolCall,
                parameters: params
            }];
        }
        
        return [];
    }

    formatResponse(response) {
        // Don't remove tool call syntax - we need to preserve the response text
        // The tool call parsing is handled separately by parseToolCalls()
        
        if (!response) {
            console.log('formatResponse: received empty response');
            return '';
        }
        
        console.log('formatResponse: processing response:', response);
        
        // Just return the response as-is, since the API response should already be clean
        const formatted = response.trim();
        console.log('formatResponse: returning formatted response:', formatted);
        
        return formatted;
    }

    // Configuration method to set API credentials
    configure(config) {
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        // if (config.model) this.model = config.model;
        
        // Only reset simulation mode if explicitly configured to use real API
        // Keep simulation mode if it was explicitly set for MCP compatibility
        if (config.forceRealAPI === true) {
            this.useSimulationMode = false;
            console.log('Forced to use real API mode');
        } else if (this.useSimulationMode) {
            console.log('Keeping simulation mode for MCP tool compatibility');
        }
        
        console.log('Ozwell configuration updated:', {
            hasApiKey: !!this.apiKey,
            baseUrl: this.baseUrl,
            useSimulationMode: this.useSimulationMode
            // model: this.model
        });
    }

    // Method to test API connectivity
    async testConnection() {
        try {
            const testMessages = [
                { role: 'user', content: 'Hello, please introduce yourself as a medical AI assistant.' }
            ];
            
            console.log('Testing Ozwell API connection...');
            const response = await this.callOzwellAPI(testMessages);
            console.log('API connection test successful:', response);
            
            // If test is successful, ensure we're not in simulation mode
            this.useSimulationMode = false;
            
            return { success: true, response };
        } catch (error) {
            console.error('API connection test failed:', error);
            
            // Try to provide more helpful error information
            if (error.message.includes('400')) {
                console.log('400 error suggests invalid request format. This might mean:');
                console.log('1. The API endpoint URL is incorrect');
                console.log('2. The API key is invalid');
                console.log('3. The request body format is not what the API expects');
                console.log('4. Required headers are missing');
                console.log('');
                console.log('Current config:');
                console.log('- API Key:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'Not set');
                console.log('- Base URL:', this.baseUrl);
                console.log('- Model:', this.model);
            }
            
            return { success: false, error: error.message };
        }
    }

    // Method to manually enable simulation mode (useful for development/testing)
    enableSimulationMode() {
        this.useSimulationMode = true;
        console.log('Simulation mode enabled - API calls will be skipped');
    }

    // Method to check if simulation mode is active
    isSimulationMode() {
        return this.useSimulationMode;
    }

    // Method to reset and retry API mode
    retryAPIMode() {
        this.useSimulationMode = false;
        console.log('API mode re-enabled - will attempt API calls again');
    }

    // Method to handle tool results and generate follow-up responses
    async handleToolResult(toolName, toolResult, originalContext) {
        console.log('Handling tool result for:', toolName, toolResult);
        
        // Update the system prompt with current context
        this.updateSystemPrompt(toolResult.data);
        
        // Generate a contextual follow-up based on the tool result
        const followUpPrompt = this.generateFollowUpPrompt(toolName, toolResult, originalContext);
        
        try {
            // Generate a response incorporating the tool result
            const followUpMessages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: followUpPrompt }
            ];
            
            const response = await this.generateResponse(followUpMessages);
            return response;
        } catch (error) {
            console.error('Error generating follow-up response:', error);
            return this.generateFallbackResponse(toolName, toolResult);
        }
    }

    // Update system prompt with current patient context
    updateSystemPrompt(contextData) {
        let contextInfo = '';
        
        if (contextData) {
            contextInfo = `

CURRENT PATIENT CONTEXT:
- Name: ${contextData.name || 'Unknown'}
- Age: ${contextData.age || 'Unknown'}
- Gender: ${contextData.gender || 'Unknown'}
- Current Medications: ${contextData.medications ? contextData.medications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join(', ') : 'None'}
- Allergies: ${contextData.allergies ? contextData.allergies.map(a => `${a.allergen} (${a.reaction})`).join(', ') : 'None'}
- Medical History: ${contextData.medicalHistory ? contextData.medicalHistory.join(', ') : 'None'}

Please use this context when making clinical decisions and recommendations.`;
        }

        this.systemPrompt = `You are Ozwell, a medical AI assistant integrated with a medical practice management system. You have access to the following tools:

AVAILABLE TOOLS:
- getContext(): Retrieve current patient medical information
- addMedication(medication): Add a new medication (requires: name, dose, frequency, indication)
- discontinueMedication(medication): Remove a medication from patient's list
- addAllergy(allergy): Add a new allergy (requires: allergen, reaction, severity)

IMPORTANT GUIDELINES:
- Always check current patient context before making changes
- Verify medication interactions and allergies before adding medications
- Use clinically appropriate dosing and frequencies
- Be precise with medical terminology
- Ask for clarification if medication details are incomplete
- Provide clinical rationale for your recommendations${contextInfo}

When you need to use a tool, format your response with:
TOOL_CALL: {toolName}
PARAMS: {parameters as JSON}

For example:
TOOL_CALL: addMedication
PARAMS: {"name": "Amoxicillin", "dose": "500mg", "frequency": "twice daily", "indication": "Bacterial infection"}
`;
    }

    // Update Ozwell with tools context
    updateToolsContext(toolsContext) {
        console.log('*** Ozwell received tools context ***', toolsContext);
        console.log('*** Tools available:', toolsContext.availableTools?.length || 0);
        
        this.toolsContext = toolsContext;
        
        // Update system prompt with comprehensive tools information
        this.systemPrompt = `You are Ozwell, a medical AI assistant integrated with a medical practice management system. You have access to the following tools:

AVAILABLE TOOLS:
${toolsContext.availableTools.map(tool => {
    const paramsList = typeof tool.parameters === 'object' ? 
        Object.entries(tool.parameters).map(([key, desc]) => `  - ${key}: ${desc}`).join('\n') : 
        '';
    return `- ${tool.name}(): ${tool.description}${paramsList ? '\n' + paramsList : ''}`;
}).join('\n')}

CURRENT PATIENT CONTEXT:
${toolsContext.currentContext ? `- Name: ${toolsContext.currentContext.name || 'Unknown'}
- Age: ${toolsContext.currentContext.age || 'Unknown'}
- Current Medications: ${toolsContext.currentContext.medications ? toolsContext.currentContext.medications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join(', ') : 'None'}
- Allergies: ${toolsContext.currentContext.allergies ? toolsContext.currentContext.allergies.map(a => `${a.allergen} (${a.reaction})`).join(', ') : 'None'}` : 'No patient context available yet'}

IMPORTANT GUIDELINES:
- ALWAYS use getContext() first if you don't have current patient information or if context seems outdated
- For medication requests, extract medication details and add them using appropriate tools
- Use standard medication names and dosages (e.g., "Dolo 650" = "Paracetamol 650mg")
- Be proactive and use tools rather than asking for more information when details are clear
- Provide brief, professional responses after tool execution
- Verify medication interactions and allergies before adding medications
- Use clinically appropriate dosing and frequencies

MEDICATION EXAMPLES:
- "dolo650" or "dolo 650" = Paracetamol 650mg for pain/fever
- Common dosing: 650mg every 6-8 hours as needed, max 3000mg/day

When you need to use a tool, format your response with:
TOOL_CALL: {toolName}
PARAMS: {parameters as JSON}

For example:
TOOL_CALL: addMedication
PARAMS: {"name": "Paracetamol", "dose": "650mg", "frequency": "every 6-8 hours as needed", "indication": "Pain and fever relief"}
`;

        console.log('*** Updated Ozwell system prompt with tools context ***');
        console.log('*** Tools available:', toolsContext.availableTools.map(t => t.name).join(', ') || 'None');
        console.log('*** System prompt now includes tools:', this.systemPrompt.includes('AVAILABLE TOOLS'));
    }

    // Generate contextual follow-up prompt based on tool result
    generateFollowUpPrompt(toolName, toolResult, originalContext) {
        const success = toolResult.success;
        const data = toolResult.data;
        const error = toolResult.error;
        
        switch (toolName) {
            case 'getContext':
                if (success) {
                    // Check if this was called in response to a medication request
                    const recentMessages = this.getRecentUserMessages();
                    const lastMessage = recentMessages[recentMessages.length - 1] || '';
                    
                    console.log('*** Checking if this was a medication request ***');
                    console.log('Last user message:', lastMessage);
                    
                    if (this.isMedicationRequest(lastMessage)) {
                        console.log('*** Detected medication request, generating medication response with context ***');
                        // Generate medication response with context
                        return this.generateMedicationResponseWithContext(lastMessage, data);
                    }
                    
                    // For any other request, provide context summary and ask what they need
                    return `I've retrieved the patient's information:

📋 **Patient Summary:**
- Name: ${data.name || 'Not specified'}
- Age: ${data.age || 'Not specified'} 
- Current Medications: ${data.medications && data.medications.length > 0 ? data.medications.map(m => `${m.name} ${m.dose}`).join(', ') : 'None'}
- Allergies: ${data.allergies && data.allergies.length > 0 ? data.allergies.map(a => a.allergen).join(', ') : 'None'}

How can I assist you with this patient's care today?`;
                } else {
                    return `I was unable to retrieve the patient's context due to: ${error}. Please acknowledge this limitation and ask how I can still assist.`;
                }
                
            case 'addMedication':
                if (success) {
                    const medName = originalContext?.parameters?.name || 'the medication';
                    return `I have successfully added ${medName} to the patient's medication list. Please provide a brief confirmation and mention any important considerations like monitoring requirements, potential side effects, or drug interactions to watch for.`;
                } else {
                    return `I was unable to add the medication due to: ${error}. Please acknowledge this issue and suggest alternative approaches or ask for clarification.`;
                }
                
            case 'discontinueMedication':
                if (success) {
                    const medName = originalContext?.parameters || 'the medication';
                    return `I have successfully discontinued ${medName} from the patient's medication list. Please provide a brief confirmation and mention any important considerations like potential withdrawal effects or alternative treatments that might be needed.`;
                } else {
                    return `I was unable to discontinue the medication due to: ${error}. Please acknowledge this issue and suggest how to proceed.`;
                }
                
            case 'addAllergy':
                if (success) {
                    const allergen = originalContext?.parameters?.allergen || 'the allergen';
                    return `I have successfully added the ${allergen} allergy to the patient's profile. Please provide a brief confirmation and mention the importance of avoiding this allergen and informing all healthcare providers.`;
                } else {
                    return `I was unable to add the allergy due to: ${error}. Please acknowledge this issue and explain the importance of manually documenting this allergy.`;
                }
                
            default:
                return `The ${toolName} operation ${success ? 'completed successfully' : 'failed'}. Please provide an appropriate response based on this result.`;
        }
    }

    // Generate fallback response if follow-up generation fails
    generateFallbackResponse(toolName, toolResult) {
        if (toolResult.success) {
            return `✅ ${toolName} completed successfully. ${toolResult.message || 'The operation was completed.'}`;
        } else {
            return `❌ ${toolName} failed: ${toolResult.error || 'Unknown error occurred.'}`;
        }
    }

    // Helper method to get recent user messages (for context checking)
    getRecentUserMessages() {
        // This will be populated by the MCP client
        return this.recentMessages || [];
    }

    // Helper method to check if a message is a medication request
    isMedicationRequest(message) {
        const msg = message.toLowerCase();
        return (msg.includes('add') || msg.includes('prescribe') || msg.includes('start') || 
                msg.includes('give') || msg.includes('put on') || msg.includes('begin')) &&
               (msg.includes('dolo') || msg.includes('medication') || msg.includes('paracetamol') ||
                msg.includes('acetaminophen') || msg.includes('ibuprofen') || msg.match(/\d+mg/));
    }

    // Generate medication response with patient context
    generateMedicationResponseWithContext(originalMessage, patientContext) {
        const medicationResponse = this.generateMedicationResponse(originalMessage);
        
        // Add context-aware safety note
        let safetyNote = '';
        if (patientContext && patientContext.allergies && patientContext.allergies.length > 0) {
            const allergens = patientContext.allergies.map(a => a.allergen).join(', ');
            safetyNote = ` Note: Patient has known allergies to ${allergens}. Please verify compatibility.`;
        }
        
        return medicationResponse + safetyNote;
    }

    // Keep existing helper methods for fallback simulation
    generateMedicationResponse(message) {
        return this.simulateLLMMedicationExtraction(message);
    }

    simulateLLMMedicationExtraction(message) {
        // This simulates how an LLM would intelligently parse medication requests
        const msg = message.toLowerCase();
        
        // LLM-like intelligence to understand context and extract medication info
        let medicationName = '';
        let dose = '';
        let frequency = '';
        let indication = '';

        // Intelligent extraction based on medical context
        if (msg.includes('pain') || msg.includes('headache') || msg.includes('fever')) {
            if (msg.includes('ibuprofen') || msg.includes('advil')) {
                medicationName = 'Ibuprofen';
                dose = '400mg';
                frequency = 'every 6-8 hours as needed';
                indication = 'Pain and inflammation';
            } else if (msg.includes('acetaminophen') || msg.includes('tylenol') || msg.includes('paracetamol')) {
                medicationName = 'Acetaminophen';
                dose = '500mg';
                frequency = 'every 6 hours as needed';
                indication = 'Pain and fever';
            } else if (msg.includes('dolo')) {
                medicationName = 'Paracetamol';
                dose = '650mg';
                frequency = 'every 6-8 hours as needed';
                indication = 'Pain and fever relief';
            } else {
                // Default pain medication
                medicationName = 'Acetaminophen';
                dose = '500mg';
                frequency = 'every 6 hours as needed';
                indication = 'Pain relief';
            }
        } else if (msg.includes('infection') || msg.includes('antibiotic') || msg.includes('bacterial')) {
            if (msg.includes('amoxicillin')) {
                medicationName = 'Amoxicillin';
                dose = '500mg';
                frequency = 'three times daily';
                indication = 'Bacterial infection';
            } else if (msg.includes('azithromycin')) {
                medicationName = 'Azithromycin';
                dose = '250mg';
                frequency = 'once daily';
                indication = 'Bacterial infection';
            } else {
                medicationName = 'Amoxicillin';
                dose = '500mg';
                frequency = 'three times daily';
                indication = 'Bacterial infection';
            }
        } else if (msg.includes('blood pressure') || msg.includes('hypertension') || msg.includes('bp')) {
            if (msg.includes('lisinopril')) {
                medicationName = 'Lisinopril';
                dose = '10mg';
                frequency = 'once daily';
                indication = 'Hypertension';
            } else if (msg.includes('amlodipine')) {
                medicationName = 'Amlodipine';
                dose = '5mg';
                frequency = 'once daily';
                indication = 'Hypertension';
            } else {
                medicationName = 'Lisinopril';
                dose = '10mg';
                frequency = 'once daily';
                indication = 'Hypertension';
            }
        } else if (msg.includes('diabetes') || msg.includes('blood sugar') || msg.includes('glucose')) {
            if (msg.includes('metformin')) {
                medicationName = 'Metformin';
                dose = '500mg';
                frequency = 'twice daily';
                indication = 'Type 2 diabetes';
            } else if (msg.includes('insulin')) {
                medicationName = 'Insulin';
                dose = 'as prescribed';
                frequency = 'as directed';
                indication = 'Diabetes management';
            } else {
                medicationName = 'Metformin';
                dose = '500mg';
                frequency = 'twice daily';
                indication = 'Type 2 diabetes';
            }
        } else {
            // Try to extract medication name using intelligent pattern matching
            const medicationPatterns = [
                /(?:add|prescribe|start|give)\s+([a-zA-Z]+(?:\s+\d+)?)/i,
                /(?:put\s+(?:on|patient\s+on))\s+([a-zA-Z]+(?:\s+\d+)?)/i,
                /([a-zA-Z]+)\s+for/i,
                /([a-zA-Z]+)\s+\d+mg/i
            ];

            for (const pattern of medicationPatterns) {
                const match = message.match(pattern);
                if (match && match[1]) {
                    medicationName = match[1].trim();
                    // Capitalize first letter
                    medicationName = medicationName.charAt(0).toUpperCase() + medicationName.slice(1);
                    break;
                }
            }

            // If we found a medication name, set defaults
            if (medicationName) {
                dose = '500mg';
                frequency = 'twice daily';
                indication = 'As prescribed by physician';
            }
        }

        // Extract specific dose if mentioned
        const doseMatch = msg.match(/(\d+\.?\d*)\s*(?:mg|milligram|gram|g)/i);
        if (doseMatch) {
            const unit = doseMatch[0].toLowerCase().includes('gram') && !doseMatch[0].toLowerCase().includes('milligram') ? 'g' : 'mg';
            dose = `${doseMatch[1]}${unit}`;
        }

        // Extract specific frequency if mentioned
        if (msg.includes('once') && msg.includes('day')) {
            frequency = 'once daily';
        } else if (msg.includes('twice') && msg.includes('day')) {
            frequency = 'twice daily';
        } else if (msg.includes('three times') && msg.includes('day')) {
            frequency = 'three times daily';
        } else if (msg.includes('every') && msg.includes('hours')) {
            const hourMatch = msg.match(/every\s+(\d+)\s+hours/);
            if (hourMatch) {
                frequency = `every ${hourMatch[1]} hours`;
            }
        }

        if (medicationName) {
            return `I'll add ${medicationName} to the patient's medication list.

TOOL_CALL: addMedication
PARAMS: {"name": "${medicationName}", "dose": "${dose}", "frequency": "${frequency}", "indication": "${indication}"}`;
        } else {
            return `I'd be happy to help add a medication. Could you please specify which medication you'd like to add and for what condition?`;
        }
    }

    generateDiscontinueResponse(message) {
        // Use LLM intelligence to extract which medication to discontinue
        const msg = message.toLowerCase();
        
        // Extract medication name using intelligent patterns
        const discontinuePatterns = [
            /(?:stop|discontinue|remove|delete|cancel)\s+([a-zA-Z]+(?:\s+\d+)?)/i,
            /(?:take\s+(?:off|away))\s+([a-zA-Z]+(?:\s+\d+)?)/i,
            /(?:no\s+more)\s+([a-zA-Z]+(?:\s+\d+)?)/i
        ];

        let medicationName = '';
        
        for (const pattern of discontinuePatterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                medicationName = match[1].trim();
                // Capitalize first letter
                medicationName = medicationName.charAt(0).toUpperCase() + medicationName.slice(1);
                break;
            }
        }

        // Also check for common medication names directly mentioned
        const commonMeds = ['lisinopril', 'amoxicillin', 'metformin', 'ibuprofen', 'acetaminophen', 'dolo'];
        for (const med of commonMeds) {
            if (msg.includes(med)) {
                medicationName = med.charAt(0).toUpperCase() + med.slice(1);
                break;
            }
        }

        if (medicationName) {
            return `I'll discontinue ${medicationName} from the patient's medication list.

TOOL_CALL: discontinueMedication
PARAMS: "${medicationName}"`;
        } else {
            return `I'd be happy to help discontinue a medication. Could you please specify which medication you'd like to stop?`;
        }
    }

    generateAllergyResponse(message) {
        // Use LLM intelligence to extract allergy information
        const msg = message.toLowerCase();
        
        let allergen = '';
        let reaction = 'Unknown reaction';
        let severity = 'Moderate';

        // Common allergies and their typical reactions
        if (msg.includes('penicillin')) {
            allergen = 'Penicillin';
            reaction = 'Hives and skin rash';
            severity = 'Severe';
        } else if (msg.includes('sulfa') || msg.includes('sulfon')) {
            allergen = 'Sulfa drugs';
            reaction = 'Skin rash';
            severity = 'Moderate';
        } else if (msg.includes('aspirin')) {
            allergen = 'Aspirin';
            reaction = 'Respiratory issues';
            severity = 'Severe';
        } else if (msg.includes('ibuprofen')) {
            allergen = 'Ibuprofen';
            reaction = 'Stomach upset and rash';
            severity = 'Moderate';
        } else if (msg.includes('codeine')) {
            allergen = 'Codeine';
            reaction = 'Nausea and dizziness';
            severity = 'Moderate';
        } else if (msg.includes('latex')) {
            allergen = 'Latex';
            reaction = 'Contact dermatitis';
            severity = 'Moderate';
        } else {
            // Try to extract allergen using patterns
            const allergyPatterns = [
                /(?:allergic\s+to|allergy\s+to)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
                /(?:react\s+to|reacts\s+to)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
                /(?:add\s+allergy)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i
            ];

            for (const pattern of allergyPatterns) {
                const match = message.match(pattern);
                if (match && match[1]) {
                    allergen = match[1].trim();
                    // Capitalize first letter
                    allergen = allergen.charAt(0).toUpperCase() + allergen.slice(1);
                    break;
                }
            }
        }

        // Extract reaction if specified
        if (msg.includes('hives')) reaction = 'Hives';
        else if (msg.includes('rash')) reaction = 'Skin rash';
        else if (msg.includes('swelling')) reaction = 'Swelling';
        else if (msg.includes('breathing')) reaction = 'Difficulty breathing';
        else if (msg.includes('nausea')) reaction = 'Nausea';

        // Extract severity if specified
        if (msg.includes('severe') || msg.includes('serious')) severity = 'Severe';
        else if (msg.includes('mild') || msg.includes('minor')) severity = 'Mild';
        else if (msg.includes('moderate')) severity = 'Moderate';

        if (allergen) {
            return `I'll add ${allergen} allergy to the patient's profile.

TOOL_CALL: addAllergy
PARAMS: {"allergen": "${allergen}", "reaction": "${reaction}", "severity": "${severity}"}`;
        } else {
            return `I'd be happy to add an allergy. Could you please specify what the patient is allergic to?`;
        }
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
        return prompt;
    }
}

// Export for use in MCP client
window.OzwellIntegration = OzwellIntegration;
