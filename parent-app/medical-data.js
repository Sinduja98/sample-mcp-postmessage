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
            }
        });
    }

    async handleMCPRequest(data, source) {
        this.log(`Received MCP request: ${data.method}`, data.params);

        let result;
        try {
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
            }
        } catch (error) {
            result = {
                success: false,
                error: error.message
            };
        }

        // Send result back to MCP client
        source.postMessage({
            type: 'mcp-response',
            requestId: data.requestId,
            result: result
        }, '*');
    }

    // Core data access method
    getContext() {
        this.log("getContext() called via MCP");
        return {
            success: true,
            data: JSON.parse(JSON.stringify(this.patientData)) // Deep copy
        };
    }

    // Core medication management methods (called via MCP)
    addMedication(medication) {
        this.log(`addMedication() called via MCP with:`, medication);
        
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
        this.log(`editMedication() called via MCP with ID: ${medId}`, updates);
        
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
        this.log(`discontinueMedication() called via MCP with ID: ${medId}`);
        
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
        this.log(`addAllergy() called via MCP with:`, allergy);
        
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

    // Utility function for logging
    log(message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logElement = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        let logText = `[${timestamp}] ${message}`;
        if (data) {
            logText += `\n${JSON.stringify(data, null, 2)}`;
        }
        
        logEntry.textContent = logText;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
        
        console.log(message, data);
    }
}

// Global instance
window.medicalDataManager = new MedicalDataManager();