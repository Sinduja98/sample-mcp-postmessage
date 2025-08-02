// Ozwell Agent Simulator - Manages iframe and postMessage communication
class OzwellAgentSimulator {
    constructor() {
        this.iframe = null;
        this.isAgentActive = false;
        this.agentUrl = 'http://localhost:8081/'; // Adjust as needed
        
        this.initializeUI();
        this.setupMessageListener();
    }

    initializeUI() {
        // Add event listeners to buttons
        document.getElementById('runSimulation').addEventListener('click', () => {
            this.runSimulation();
        });

        document.getElementById('showContext').addEventListener('click', () => {
            this.showCurrentContext();
        });
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Security check - in production, validate event.origin
            if (event.data.type === 'mcp-request') {
                this.handleMCPRequest(event.data);
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

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: none;
            background: #ff4444;
            color: white;
            cursor: pointer;
            font-size: 16px;
            z-index: 1001;
        `;
        closeButton.onclick = () => this.closeAgent();

        document.body.appendChild(this.iframe);
        document.body.appendChild(closeButton);

        // Wait for iframe to load, then initialize
        this.iframe.onload = () => {
            this.isAgentActive = true;
            this.sendInitialContext();
        };
    }

    closeAgent() {
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
            this.isAgentActive = false;
            medicalDataManager.log("Agent iframe closed");
        }
    }

    sendInitialContext() {
        if (!this.iframe) return;

        const context = getContext();
        this.iframe.contentWindow.postMessage({
            type: 'mcp-context',
            context: context
        }, '*');

        medicalDataManager.log("Initial context sent to agent");
    }

    async handleMCPRequest(data) {
        medicalDataManager.log(`Received MCP request: ${data.method}`, data.params);

        let result;
        try {
            switch (data.method) {
                case 'getContext':
                    result = getContext();
                    break;
                case 'addMedication':
                    result = addMedication(data.params);
                    break;
                case 'discontinueMedication':
                    result = discontinueMedication(data.params.medId || data.params);
                    break;
                case 'editMedication':
                    result = editMedication(data.params.medId, data.params.updates);
                    break;
                case 'deleteMedication':
                    result = deleteMedication(data.params.medId || data.params);
                    break;
                case 'addAllergy':
                    result = addAllergy(data.params);
                    break;
                default:
                    result = {
                        success: false,
                        error: `Unknown method: ${data.method}`
                    };
            }
        } catch (error) {
            result = {
                success: false,
                error: error.message
            };
        }

        // Send result back to iframe
        if (this.iframe) {
            this.iframe.contentWindow.postMessage({
                type: 'mcp-response',
                requestId: data.requestId,
                result: result
            }, '*');
        }
    }

    runSimulation() {
        medicalDataManager.log("Starting simulation...");
        
        // Create iframe if it doesn't exist
        if (!this.iframe) {
            this.createAgentIframe();
            
            // Wait for iframe to be ready, then send simulation
            setTimeout(() => {
                // this.sendSimulationMessage();
            }, 2000);
        } 
        // else {
        //     this.sendSimulationMessage();
        // }
    }

    // sendSimulationMessage() {
    //     if (!this.iframe) return;

    //     const simulationTasks = [
    //         {
    //             action: "addMedication",
    //             data: {
    //                 name: "Amoxicillin",
    //                 dose: "500mg",
    //                 frequency: "twice daily",
    //                 indication: "Bacterial infection",
    //                 duration: "7 days"
    //             }
    //         },
    //         {
    //             action: "discontinueMedication",
    //             data: "Lisinopril"
    //         },
    //         {
    //             action: "addAllergy",
    //             data: {
    //                 allergen: "Sulfa drugs",
    //                 reaction: "Skin rash",
    //                 severity: "Moderate"
    //             }
    //         }
    //     ];

    //     this.iframe.contentWindow.postMessage({
    //         type: 'run-simulation',
    //         tasks: simulationTasks
    //     }, '*');

    //     medicalDataManager.log("Simulation message sent to agent");
    // }

    showCurrentContext() {
        const context = getContext();
        const contextDisplay = document.getElementById('contextDisplay');
        const contextJson = document.getElementById('contextJson');
        
        contextJson.textContent = JSON.stringify(context.data, null, 2);
        contextDisplay.style.display = 'block';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ozwellAgent = new OzwellAgentSimulator();
});