// Medical data management with MCP server integration
class MedicalDataManager {
    constructor() {
        this.patientData = {
            patientId: "PAT-12345",
            name: "John Doe",
            age: 65,
            medications: [
                {
                    id: "med-1",
                    name: "Lisinopril",
                    dose: "10mg",
                    frequency: "once daily",
                    indication: "Hypertension",
                    startDate: "2024-01-15"
                },
                {
                    id: "med-2",
                    name: "Metformin",
                    dose: "500mg",
                    frequency: "twice daily",
                    indication: "Type 2 Diabetes",
                    startDate: "2023-11-20"
                }
            ],
            allergies: [
                {
                    id: "allergy-1",
                    allergen: "Penicillin",
                    reaction: "Rash",
                    severity: "Moderate"
                }
            ],
            conditions: [
                "Hypertension",
                "Type 2 Diabetes",
                "Hyperlipidemia"
            ]
        };

        // Initialize MCP request handler
        this.setupMCPHandler();
        
    
    }
    

    setupMCPHandler() {
        // Listen for MCP requests from iframe
        window.addEventListener('message', (event) => {
            if (event.data.type === 'mcp-request') {
                this.handleMCPRequest(event.data, event.source);
            } else if (event.data.type === 'mcp-log') {
                // Handle log messages from MCP client
                this.handleMCPLog(event.data);
            }
        });
    }

    async handleMCPRequest(data, source) {
        // Pre-execution logging
        this.logToolInvocation(data.method, data.params);

        let result;
        const startTime = Date.now();
        
        try {
            this.log(`▶️ EXECUTING: ${data.method}`, {
                params: data.params,
                requestId: data.requestId
            });
            
            switch (data.method) {
                case 'getContext':
                    result = this.getContext();
                    break;
                case 'addMedication':
                    result = this.addMedication(data.params);
                    break;
                case 'discontinueMedication':
                    result = this.discontinueMedication(data.params.medId || data.params);
                    break;
                case 'editMedication':
                    result = this.editMedication(data.params.medId, data.params.updates);
                    break;
                case 'deleteMedication':
                    result = this.discontinueMedication(data.params.medId || data.params);
                    break;
                case 'addAllergy':
                    result = this.addAllergy(data.params);
                    break;
                default:
                    result = {
                        success: false,
                        error: `Unknown MCP method: ${data.method}`
                    };
                    this.log(`❌ UNKNOWN TOOL: ${data.method}`, { availableTools: this.getAvailableToolNames() });
            }
            
            const executionTime = Date.now() - startTime;
            this.logToolResult(data.method, result, executionTime);
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            result = {
                success: false,
                error: error.message
            };
            this.logToolError(data.method, error, executionTime);
        }

        // Send result back to MCP client
        source.postMessage({
            type: 'mcp-response',
            requestId: data.requestId,
            result: result
        }, '*');
    }
    
    logToolInvocation(toolName, params) {
        this.log(`🚀 TOOL INVOCATION: ${toolName}`, {
            tool: toolName,
            parameters: params,
            timestamp: new Date().toISOString(),
            status: 'STARTING'
        });
    }
    
    logToolResult(toolName, result, executionTime) {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        this.log(`${status} TOOL COMPLETED: ${toolName} (${executionTime}ms)`, {
            tool: toolName,
            success: result.success,
            message: result.message || result.error,
            executionTime: `${executionTime}ms`,
            data: result.success ? result.data : undefined
        });
    }
    
    logToolError(toolName, error, executionTime) {
        this.log(`💥 TOOL ERROR: ${toolName} (${executionTime}ms)`, {
            tool: toolName,
            error: error.message,
            stack: error.stack,
            executionTime: `${executionTime}ms`,
            status: 'ERROR'
        });
    }
    
    getAvailableToolNames() {
        return [
            'getContext',
            'addMedication', 
            'editMedication',
            'discontinueMedication',
            'deleteMedication',
            'addAllergy'
        ];
    }

    handleMCPLog(data) {
        // Handle log messages from MCP client
        const logMessage = `[${data.source.toUpperCase()}] ${data.message}`;
        this.log(logMessage, data.data);
    }

    // Core data access method
    getContext() {
        this.log("🔍 TOOL: getContext - Retrieving patient data");
        return {
            success: true,
            data: JSON.parse(JSON.stringify(this.patientData)) // Deep copy
        };
    }

    // Core medication management methods (called via MCP)
    addMedication(medication) {
        this.log(`💊 TOOL: addMedication - Adding ${medication.name || 'unknown medication'}`, medication);
        
        // Validate required fields
        if (!medication.name || !medication.dose || !medication.frequency) {
            return {
                success: false,
                error: "Missing required fields: name, dose, and frequency are required"
            };
        }

        // Check for drug allergies
        const allergyMatch = this.patientData.allergies.find(allergy => 
            medication.name.toLowerCase().includes(allergy.allergen.toLowerCase()) ||
            allergy.allergen.toLowerCase().includes(medication.name.toLowerCase())
        );
        
        if (allergyMatch) {
            return {
                success: false,
                error: `Cannot add ${medication.name}: Patient is allergic to ${allergyMatch.allergen} (${allergyMatch.severity} reaction)`
            };
        }

        // Check if medication already exists
        const existingMed = this.patientData.medications.find(med => 
            med.name.toLowerCase() === medication.name.toLowerCase()
        );
        
        if (existingMed) {
            return {
                success: false,
                error: `Medication ${medication.name} is already in the patient's medication list`
            };
        }
        
        const newMed = {
            id: `med-${Date.now()}`,
            name: medication.name,
            dose: medication.dose,
            frequency: medication.frequency,
            indication: medication.indication || "Not specified",
            startDate: new Date().toISOString().split('T')[0]
        };

        this.patientData.medications.push(newMed);
        
        return {
            success: true,
            data: newMed,
            message: `Successfully added ${medication.name} ${medication.dose} ${medication.frequency} to medication list`
        };
    }

    editMedication(medId, updates) {
        this.log(`✏️ TOOL: editMedication - Editing medication ${medId}`, updates);
        
        if (!medId) {
            return {
                success: false,
                error: "Medication ID or name is required"
            };
        }

        if (!updates || Object.keys(updates).length === 0) {
            return {
                success: false,
                error: "No updates provided"
            };
        }
        
        const med = this.patientData.medications.find(med => 
            med.id === medId || med.name.toLowerCase() === medId.toLowerCase()
        );

        if (!med) {
            return {
                success: false,
                error: `Medication with ID/name '${medId}' not found`
            };
        }

        // Store original values for logging
        const originalMed = { ...med };

        // Validate updates
        const validFields = ['name', 'dose', 'frequency', 'indication'];
        const invalidFields = Object.keys(updates).filter(field => !validFields.includes(field));
        
        if (invalidFields.length > 0) {
            return {
                success: false,
                error: `Invalid fields for update: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`
            };
        }

        // Check for name conflicts if name is being changed
        if (updates.name && updates.name !== med.name) {
            const nameConflict = this.patientData.medications.find(m => 
                m.id !== med.id && m.name.toLowerCase() === updates.name.toLowerCase()
            );
            
            if (nameConflict) {
                return {
                    success: false,
                    error: `Cannot change name to ${updates.name}: Another medication with this name already exists`
                };
            }
        }

        // Apply updates
        Object.assign(med, updates);
        
        const changedFields = Object.keys(updates);
        
        return {
            success: true,
            data: med,
            message: `Successfully updated ${med.name}: ${changedFields.map(field => 
                `${field} changed from '${originalMed[field]}' to '${med[field]}'`
            ).join(', ')}`
        };
    }

    discontinueMedication(medId) {
        this.log(`🚫 TOOL: discontinueMedication - Removing medication ${medId}`);
        
        const medIndex = this.patientData.medications.findIndex(med => 
            med.id === medId || med.name.toLowerCase() === medId.toLowerCase()
        );

        if (medIndex === -1) {
            return {
                success: false,
                error: `Medication with ID/name '${medId}' not found`
            };
        }

        const removedMed = this.patientData.medications.splice(medIndex, 1)[0];
        
        return {
            success: true,
            data: removedMed,
            message: `Successfully discontinued ${removedMed.name}`
        };
    }

    addAllergy(allergy) {
        this.log(`🤧 TOOL: addAllergy - Adding allergy to ${allergy.allergen || 'unknown allergen'}`, allergy);
        
        const newAllergy = {
            id: `allergy-${Date.now()}`,
            allergen: allergy.allergen,
            reaction: allergy.reaction || "Unknown reaction",
            severity: allergy.severity || "Unknown"
        };

        this.patientData.allergies.push(newAllergy);
        
        return {
            success: true,
            data: newAllergy,
            message: `Successfully added allergy to ${allergy.allergen}`
        };
    }

    // Utility function for logging with improved reliability
    log(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        
        // Always log to console first
        console.log(`[${timestamp}] ${message}`, data);
        
        // Enhanced DOM logging with multiple fallback strategies
        this.logToDOM(timestamp, message, data);
    }
    
    logToDOM(timestamp, message, data, retryCount = 0) {
        const maxRetries = 5;
        const retryDelay = 100;
        
        // Try multiple methods to find the logContainer
        let logElement = this.findLogContainer();
        
        if (logElement) {
            this.addLogEntry(logElement, timestamp, message, data);
            return;
        }
        
        // If not found and we haven't exceeded retry limit, try again
        if (retryCount < maxRetries && typeof window !== 'undefined' && typeof document !== 'undefined') {
            setTimeout(() => {
                this.logToDOM(timestamp, message, data, retryCount + 1);
            }, retryDelay * (retryCount + 1)); // Exponential backoff
        } else if (retryCount >= maxRetries) {
            console.warn(`[${timestamp}] Failed to find logContainer after ${maxRetries} retries. Message: ${message}`);
        }
    }
    
    findLogContainer() {
        // Multiple strategies to find the log container
        const strategies = [
            () => document.getElementById('logContainer'),
            () => {
                // Look for any element with "log" in its ID
                const allElements = document.querySelectorAll('[id*="log"], [class*="log"]');
                return Array.from(allElements).find(el => 
                    el.id.toLowerCase().includes('container') || 
                    el.className.toLowerCase().includes('container')
                );
            },
            () => {
                // Create the log container if it doesn't exist
                return this.createLogContainer();
            }
        ];
        
        for (const strategy of strategies) {
            try {
                const element = strategy();
                if (element) {
                    return element;
                }
            } catch (error) {
                console.debug('Log container strategy failed:', error);
            }
        }
        
        return null;
    }
    
    createLogContainer() {
        // Only create if we're in a browser environment and no container exists
        if (typeof document === 'undefined') return null;
        
        // Check if there's a container div we can use
        const container = document.querySelector('.container') || document.body;
        if (!container) return null;
        
        // Create a new log container
        const logContainer = document.createElement('div');
        logContainer.id = 'logContainer';
        logContainer.style.cssText = `
            height: 300px;
            overflow-y: auto;
            background: #000;
            color: #00ff00;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            border-radius: 4px;
            margin-top: 20px;
            border: 1px solid #ccc;
        `;
        
        // Add a title
        const title = document.createElement('h3');
        title.textContent = 'EHR Logs (Auto-created)';
        title.style.margin = '20px 0 10px 0';
        
        container.appendChild(title);
        container.appendChild(logContainer);
        
        console.log('Created new logContainer element');
        return logContainer;
    }
    
    addLogEntry(logElement, timestamp, message, data) {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        let logText = `[${timestamp}] ${message}`;
        if (data) {
            logText += `\n${JSON.stringify(data, null, 2)}`;
        }
        
        logEntry.textContent = logText;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// Export the class for use in other modules
export { MedicalDataManager };

// Global instance - will be created when DOM is loaded or when imported
if (typeof window !== 'undefined') {
    // Add initialization function
    function initializeMedicalDataManager() {
        if (!window.medicalDataManager) {
            console.log('Initializing MedicalDataManager...');
            
            // Debug DOM state
            console.log('DOM ready state:', document.readyState);
            console.log('logContainer exists:', !!document.getElementById('logContainer'));
            
            window.medicalDataManager = new MedicalDataManager();
            
            // Test logging immediately
            // window.medicalDataManager.log('🏥 MEDICAL DATA MANAGER INITIALIZED', {
            //     timestamp: new Date().toISOString(),
            //     domReady: document.readyState,
            //     logContainerFound: !!document.getElementById('logContainer')
            // });
        }
    }
    
    // Multiple initialization strategies
    if (document.readyState === 'loading') {
        // DOM is still loading
        document.addEventListener('DOMContentLoaded', initializeMedicalDataManager);
        document.addEventListener('readystatechange', () => {
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                initializeMedicalDataManager();
            }
        });
    } else {
        // DOM is already loaded (interactive or complete)
        initializeMedicalDataManager();
    }
    
    // Also try initialization after a short delay to ensure everything is ready
    setTimeout(initializeMedicalDataManager, 500);
}