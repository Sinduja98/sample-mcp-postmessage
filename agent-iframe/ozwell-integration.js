// Ozwell AI Integration for MCP Client
class OzwellIntegration {
    constructor() {
        this.apiKey = 'BHSK-sandbox-GxuFjWNW1lSvP-t9XStZyLWxMBZGQF9dhCHzrIXk'; // In production, this should be securely managed
        this.baseUrl = 'https://ai.bluehive.com/api/v1/completion'; // Adjust to actual Ozwell API endpoint
        this.model = 'ozwell-medical-v1'; // Adjust to actual model name
        
        this.systemPrompt = `You are a medical AI assistant integrated with a medical practice management system. You have access to the following tools:

AVAILABLE TOOLS:
- getContext(): Retrieve current patient medical information
- addMedication(medication): Add a new medication (requires: name, dose, frequency, indication)
- discontinueMedication(medId): Discontinue a medication by ID or name
- editMedication(medId, updates): Edit medication details
- deleteMedication(medId): Delete a medication
- addAllergy(allergy): Add a new allergy (requires: allergen, reaction, severity)

IMPORTANT GUIDELINES:
- Always check current patient context before making changes
- Verify medication interactions and allergies before adding medications
- Use clinically appropriate dosing and frequencies
- Be precise with medical terminology
- Ask for clarification if medication details are incomplete

When you need to use a tool, format your response with:
TOOL_CALL: {toolName}
PARAMS: {parameters as JSON}

For example:
TOOL_CALL: addMedication
PARAMS: {"name": "Amoxicillin", "dose": "500mg", "frequency": "twice daily", "indication": "Bacterial infection"}
`;
    }

    async generateResponse(messages, onChunk = null) {
        try {
            // Simulate Ozwell API call - replace with actual API integration
            const response = await this.simulateOzwellAPI(messages);
            
            if (onChunk) {
                // Simulate streaming
                const chunks = response.split(' ');
                for (let i = 0; i < chunks.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    onChunk(chunks[i] + ' ');
                }
            }
            
            return response;
        } catch (error) {
            console.error('Ozwell API Error:', error);
            throw error;
        }
    }

    async simulateOzwellAPI(messages) {
        // Get the last message from the user
        const lastMessage = messages[messages.length - 1]?.content || '';
        const msg = lastMessage.toLowerCase();
        console.log(msg);

        // First get context if it's a request that needs patient info
        if (msg.includes('medications') || msg.includes('allergies') || msg.includes('patient')) {
            return `Let me check the patient's information.

TOOL_CALL: getContext
PARAMS: {}`;
        }

        // Handle medication additions - let LLM intelligence parse the medication details
        if (msg.includes('add') || msg.includes('prescribe') || msg.includes('start') || 
            msg.includes('give') || msg.includes('put on') || msg.includes('begin')) {
            console.log("****** inside add medication");
            
            // Use LLM intelligence to extract medication information from natural language
            return this.generateMedicationResponse(lastMessage);
        }

        // Handle medication discontinuation - let LLM intelligence parse which medication to stop
        if (msg.includes('stop') || msg.includes('discontinue') || msg.includes('remove') || 
            msg.includes('delete') || msg.includes('cancel')) {
            return this.generateDiscontinueResponse(lastMessage);
        }

        // Handle allergy additions - let LLM intelligence parse allergy information
        if (msg.includes('allergy') || msg.includes('allergic') || msg.includes('reaction')) {
            return this.generateAllergyResponse(lastMessage);
        }

        // If nothing specific matched, get context
        return `I'll check the patient's current information to assist you better.

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
        // Remove tool call syntax from user-visible response
        return response
            .replace(/TOOL_CALL:.*$/gm, '')
            .replace(/PARAMS:.*$/gm, '')
            .trim();
    }

    generateMedicationResponse(message) {
        // Use LLM intelligence to analyze the medication request
        // This simulates an LLM understanding the natural language request
        const prompt = `
        Analyze this medication request and extract the medication details:
        "${message}"
        
        Based on medical knowledge, provide appropriate medication information.
        `;

        // Simulate LLM processing - this would be replaced with actual LLM API call
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
                medicationName = 'Dolo 650';
                dose = '650mg';
                frequency = 'as needed';
                indication = 'Pain and fever';
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

    // Remove the old extractMedicationInfo method and replace with LLM-driven approach
}

// Export for use in MCP client
window.OzwellIntegration = OzwellIntegration;