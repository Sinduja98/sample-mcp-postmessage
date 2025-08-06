// Medical MCP Server - Proper MCP implementation using Model Context Protocol SDK
// import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Schema definitions for medication data
const medicationSchema = z.object({
    name: z.string().describe("Name of the medication"),
    dose: z.string().describe("Dosage of the medication (e.g., '10mg', '500mg')"),
    frequency: z.string().describe("How often to take the medication (e.g., 'once daily', 'twice daily')"),
    indication: z.string().optional().describe("Reason for prescribing (optional)")
});

const editMedicationSchema = z.object({
    medId: z.string().describe("ID or name of the medication to edit"),
    updates: z.object({
        name: z.string().optional().describe("New name of the medication"),
        dose: z.string().optional().describe("New dosage of the medication"),
        frequency: z.string().optional().describe("New frequency for the medication"),
        indication: z.string().optional().describe("New indication for the medication")
    }).describe("Updates to apply to the medication")
});

class MedicalMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: "medical-server",
                version: "1.0.0"
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );
        
        // Local medication storage for iframe
        this.localMedications = [];
        this.localAllergies = [];
        this.patientInfo = {
            patientId: "PAT-12345",
            name: "John Doe",
            age: 65
        };
        
        this.setupTools();
        this.requestCounter = 0;
    }

    setupTools() {
        // Register addMedication tool
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "addMedication",
                        description: "Add a new medication to patient records",
                        inputSchema: medicationSchema
                    },
                    {
                        name: "editMedication", 
                        description: "Edit an existing medication in patient records",
                        inputSchema: editMedicationSchema
                    },
                    {
                        name: "getContext",
                        description: "Get current patient context",
                        inputSchema: z.object({})
                    },
                    {
                        name: "discontinueMedication",
                        description: "Discontinue an existing medication",
                        inputSchema: z.object({
                            medId: z.string().describe("ID or name of medication to discontinue")
                        })
                    },
                    {
                        name: "addAllergy",
                        description: "Add a new allergy to patient records",
                        inputSchema: z.object({
                            allergen: z.string().describe("The substance the patient is allergic to"),
                            reaction: z.string().optional().describe("The type of reaction"),
                            severity: z.enum(["Mild", "Moderate", "Severe"]).optional().describe("Severity of the allergic reaction")
                        })
                    }
                ]
            };
        });

        // Register tool call handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                switch (name) {
                    case "addMedication":
                        return await this.callAddMedication(args);
                    case "editMedication":
                        return await this.callEditMedication(args);
                    case "getContext":
                        return await this.callGetContext(args);
                    case "discontinueMedication":
                        return await this.callDiscontinueMedication(args);
                    case "addAllergy":
                        return await this.callAddAllergy(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error executing ${name}: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    async callAddMedication(args) {
        console.log('MCP Tool: addMedication called with:', args);
        
        try {
            // Validate input
            const validatedArgs = medicationSchema.parse(args);
            
            // Validate required fields
            if (!validatedArgs.name || !validatedArgs.dose || !validatedArgs.frequency) {
                const error = "Missing required fields: name, dose, and frequency are required";
                this.sendMedicationResponse('addMedication', {
                    success: false,
                    error: error
                });
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error}`
                        }
                    ],
                    isError: true
                };
            }

            // Check for drug allergies
            const allergyMatch = this.localAllergies.find(allergy => 
                validatedArgs.name.toLowerCase().includes(allergy.allergen.toLowerCase()) ||
                allergy.allergen.toLowerCase().includes(validatedArgs.name.toLowerCase())
            );
            
            if (allergyMatch) {
                const error = `Cannot add ${validatedArgs.name}: Patient is allergic to ${allergyMatch.allergen} (${allergyMatch.severity} reaction)`;
                this.sendMedicationResponse('addMedication', {
                    success: false,
                    error: error
                });
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error}`
                        }
                    ],
                    isError: true
                };
            }

            // Check if medication already exists
            const existingMed = this.localMedications.find(med => 
                med.name.toLowerCase() === validatedArgs.name.toLowerCase()
            );
            
            if (existingMed) {
                const error = `Medication ${validatedArgs.name} is already in the patient's medication list`;
                this.sendMedicationResponse('addMedication', {
                    success: false,
                    error: error
                });
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error}`
                        }
                    ],
                    isError: true
                };
            }
            
            // Create new medication
            const newMed = {
                id: `med-${Date.now()}`,
                name: validatedArgs.name,
                dose: validatedArgs.dose,
                frequency: validatedArgs.frequency,
                indication: validatedArgs.indication || "Not specified",
                startDate: new Date().toISOString().split('T')[0]
            };

            // Add to local storage
            this.localMedications.push(newMed);
            
            const successMessage = `Successfully added ${validatedArgs.name} ${validatedArgs.dose} ${validatedArgs.frequency} to medication list`;
            
            // Send response to iframe listener
            this.sendMedicationResponse('addMedication', {
                success: true,
                data: newMed,
                message: successMessage
            });
            
            return {
                content: [
                    {
                        type: "text",
                        text: successMessage
                    }
                ],
                isError: false
            };
            
        } catch (error) {
            const errorMessage = `Error adding medication: ${error.message}`;
            this.sendMedicationResponse('addMedication', {
                success: false,
                error: errorMessage
            });
            
            return {
                content: [
                    {
                        type: "text",
                        text: errorMessage
                    }
                ],
                isError: true
            };
        }
    }

    async callEditMedication(args) {
        console.log('MCP Tool: editMedication called with:', args);
        
        // Validate input
        const validatedArgs = editMedicationSchema.parse(args);
        
        return new Promise((resolve) => {
            const requestId = `mcp-${++this.requestCounter}`;
            
            window.mcpPendingRequests = window.mcpPendingRequests || {};
            window.mcpPendingRequests[requestId] = (result) => {
                const mcpResponse = {
                    content: [
                        {
                            type: "text",
                            text: result.success 
                                ? (result.message || 'Operation completed successfully')
                                : `Error: ${result.error}`
                        }
                    ],
                    isError: !result.success
                };
                resolve(mcpResponse);
            };
            
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: 'editMedication',
                params: {
                    medId: validatedArgs.medId,
                    updates: validatedArgs.updates
                }
            }, '*');
        });
    }

    async callGetContext(args) {
        console.log('MCP Tool: getContext called');
        
        return new Promise((resolve) => {
            const requestId = `mcp-${++this.requestCounter}`;
            
            window.mcpPendingRequests = window.mcpPendingRequests || {};
            window.mcpPendingRequests[requestId] = (result) => {
                const mcpResponse = {
                    content: [
                        {
                            type: "text",
                            text: result.success 
                                ? JSON.stringify(result.data, null, 2)
                                : `Error: ${result.error}`
                        }
                    ],
                    isError: !result.success
                };
                resolve(mcpResponse);
            };
            
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: 'getContext',
                params: {}
            }, '*');
        });
    }

    async callDiscontinueMedication(args) {
        console.log('MCP Tool: discontinueMedication called with:', args);
        
        return new Promise((resolve) => {
            const requestId = `mcp-${++this.requestCounter}`;
            
            window.mcpPendingRequests = window.mcpPendingRequests || {};
            window.mcpPendingRequests[requestId] = (result) => {
                const mcpResponse = {
                    content: [
                        {
                            type: "text",
                            text: result.success 
                                ? (result.message || 'Operation completed successfully')
                                : `Error: ${result.error}`
                        }
                    ],
                    isError: !result.success
                };
                resolve(mcpResponse);
            };
            
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: 'discontinueMedication',
                params: args.medId
            }, '*');
        });
    }

    async callAddAllergy(args) {
        console.log('MCP Tool: addAllergy called with:', args);
        
        return new Promise((resolve) => {
            const requestId = `mcp-${++this.requestCounter}`;
            
            window.mcpPendingRequests = window.mcpPendingRequests || {};
            window.mcpPendingRequests[requestId] = (result) => {
                const mcpResponse = {
                    content: [
                        {
                            type: "text",
                            text: result.success 
                                ? (result.message || 'Operation completed successfully')
                                : `Error: ${result.error}`
                        }
                    ],
                    isError: !result.success
                };
                resolve(mcpResponse);
            };
            
            window.parent.postMessage({
                type: 'mcp-request',
                requestId: requestId,
                method: 'addAllergy',
                params: args
            }, '*');
        });
    }

    // Helper method to send responses to iframe listeners
    sendMedicationResponse(method, result) {
        // Send response to any listeners in the iframe
        window.postMessage({
            type: 'medication-response',
            method: method,
            result: result,
            timestamp: new Date().toISOString()
        }, '*');
        
        // Also log the action
        console.log(`Medical action completed: ${method}`, result);
    }

    // Get current context including local medications and allergies
    getLocalContext() {
        return {
            patientInfo: this.patientInfo,
            medications: [...this.localMedications],
            allergies: [...this.localAllergies],
            totalMedications: this.localMedications.length,
            totalAllergies: this.localAllergies.length
        };
    }

    async initialize() {
        console.log('Initializing Medical MCP Server with Model Context Protocol SDK...');
        
        // Setup message listener for responses from parent (MedicalDataManager)
        window.addEventListener('message', (event) => {
            if (event.data.type === 'mcp-response') {
                const { requestId, result } = event.data;
                const pendingRequest = window.mcpPendingRequests?.[requestId];
                
                if (pendingRequest) {
                    // Call the pending request with the result
                    pendingRequest(result);
                    delete window.mcpPendingRequests[requestId];
                }
            }
            if (event.data.type=='request-tools-context'){
                // Respond with available tools
                event.source.postMessage({
                    type: 'tools-context',
                    tools: this.getTools()
                }, '*');
            }

        
            // Listen for medication responses within iframe
            if (event.data.type === 'medication-response') {
                console.log('Medication response received:', event.data);
                // You can add custom handling here for UI updates, notifications, etc.
                
                // Example: Update UI or trigger events
                const customEvent = new CustomEvent('medicationUpdate', {
                    detail: event.data
                });
                window.dispatchEvent(customEvent);
            }
        });
        
        // Initialize with some default allergies for testing
        this.localAllergies = [
            {
                id: "allergy-1",
                allergen: "Penicillin",
                reaction: "Rash",
                severity: "Moderate"
            }
        ];
        
        this.initialized = true;
        console.log('Medical MCP Server initialized successfully with tools: addMedication, editMedication, getContext, discontinueMedication, addAllergy');
        console.log('Local medication storage initialized. Use window.medicationServer.getLocalContext() to view current state.');
        
        return this;
    }

    isInitialized() {
        return this.initialized;
    }

    // Get available tools
    getTools() {
        return [
            'addMedication',
            'editMedication', 
            'getContext',
            'discontinueMedication',
            'addAllergy'
        ];
    }

    // Execute a tool directly (for testing)
    async executeTool(toolName, parameters) {
        const request = {
            params: {
                name: toolName,
                arguments: parameters
            }
        };
        
        return await this.server.handleRequest({
            method: 'tools/call',
            params: request.params
        });
    }
}

// Export for use in MCP client
window.MedicalMCPServer = MedicalMCPServer;

// Auto-initialize and expose server instance for testing
window.addEventListener('DOMContentLoaded', async () => {
    const server = new MedicalMCPServer();
    await server.initialize();
    window.medicationServer = server;
    
    console.log('Medical MCP Server is ready!');
    console.log('Try: window.medicationServer.executeTool("addMedication", {name: "Aspirin", dose: "81mg", frequency: "once daily", indication: "Cardioprotection"})');
});
