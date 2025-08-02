// Medical data management and MCP server functions
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
    }

    // MCP Server Function: Get Context
    getContext() {
        this.log("getContext() called");
        return {
            success: true,
            data: JSON.parse(JSON.stringify(this.patientData)) // Deep copy
        };
    }

    // MCP Server Function: Add Medication
    addMedication(medication) {
        this.log(`addMedication() called with:`, medication);
        
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
            message: `Successfully added ${medication.name} to medication list`
        };
    }

    // MCP Server Function: Discontinue Medication
    discontinueMedication(medId) {
        this.log(`discontinueMedication() called with ID: ${medId}`);
        
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

    // MCP Server Function: Edit Medication
    editMedication(medId, updates) {
        this.log(`editMedication() called with ID: ${medId}`, updates);
        
        const med = this.patientData.medications.find(med => 
            med.id === medId || med.name.toLowerCase() === medId.toLowerCase()
        );

        if (!med) {
            return {
                success: false,
                error: `Medication with ID/name '${medId}' not found`
            };
        }

        Object.assign(med, updates);
        
        return {
            success: true,
            data: med,
            message: `Successfully updated ${med.name}`
        };
    }

    // MCP Server Function: Delete Medication
    deleteMedication(medId) {
        return this.discontinueMedication(medId); // Same functionality
    }

    // MCP Server Function: Add Allergy
    addAllergy(allergy) {
        this.log(`addAllergy() called with:`, allergy);
        
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

// Expose MCP server functions globally
window.getContext = () => window.medicalDataManager.getContext();
window.addMedication = (med) => window.medicalDataManager.addMedication(med);
window.discontinueMedication = (medId) => window.medicalDataManager.discontinueMedication(medId);
window.editMedication = (medId, updates) => window.medicalDataManager.editMedication(medId, updates);
window.deleteMedication = (medId) => window.medicalDataManager.deleteMedication(medId);
window.addAllergy = (allergy) => window.medicalDataManager.addAllergy(allergy);