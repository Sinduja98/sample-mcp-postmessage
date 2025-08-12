// Medical MCP Server - Proper MCP implementation using Model Context Protocol SDK
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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

const allergySchema = z.object({
    allergen: z.string().describe("The substance the patient is allergic to"),
    reaction: z.string().optional().describe("The type of reaction"),
    severity: z.enum(["Mild", "Moderate", "Severe"]).optional().describe("Severity of the allergic reaction")
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
        
        // Local medical data storage
        this.localMedications = [];
        this.localAllergies = [];
        this.patientInfo = {
            patientId: "PAT-12345",
            name: "John Doe",
            age: 65
        };
        
        this.setupTools();
        this.setupEventListeners();
        this.requestCounter = 0;
        
        // Store available tools definition
        this.toolsDefinition = [
            {
                name: "addMedication",
                description: "Add a new medication to patient records with proper validation and allergy checking",
                inputSchema: medicationSchema
            },
            {
                name: "editMedication", 
                description: "Edit an existing medication in patient records with conflict validation",
                inputSchema: editMedicationSchema
            },
            {
                name: "getContext",
                description: "Get current patient context including medications, allergies, and conditions",
                inputSchema: z.object({})
            },
            {
                name: "discontinueMedication",
                description: "Discontinue an existing medication from patient records",
                inputSchema: z.object({
                    medId: z.string().describe("ID or name of medication to discontinue")
                })
            },
            {
                name: "addAllergy",
                description: "Add a new allergy to patient records",
                inputSchema: allergySchema
            }
        ];
    }

    setupTools() {
        // Register tools list handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: this.toolsDefinition
            };
        });

        // Register tool call handler
        // this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        //     const { name, arguments: args } = request.params;
            
        //     try {
        //         switch (name) {
        //             case "addMedication":
        //                 return await this.executeAddMedication(args);
        //             case "editMedication":
        //                 return await this.executeEditMedication(args);
        //             case "getContext":
        //                 return await this.executeGetContext(args);
        //             case "discontinueMedication":
        //                 return await this.executeDiscontinueMedication(args);
        //             case "addAllergy":
        //                 return await this.executeAddAllergy(args);
        //             default:
        //                 throw new Error(`Unknown tool: ${name}`);
        //         }
        //     } catch (error) {
        //         return {
        //             content: [
        //                 {
        //                     type: "text",
        //                     text: `Error executing ${name}: ${error.message}`
        //                 }
        //             ],
        //             isError: true
        //         };
        //     }
        // });
    }

    setupEventListeners() {
        // Setup message listener for requests from MCP Client (Ozwell iframe)
        window.addEventListener('message', (event) => {
            console.log('MCP Server received message:', event.data);

            // FILTER: Ignore messages that MCP Server sent
            if (event.data.type === 'mcp-tool-response' || event.data.type === 'mcp-tools-available') {
                return; // These are sent BY MCP Server, not TO MCP Server
            }
            
            switch (event.data.type) {
                case 'mcp-get-tools':
                    // Send available tools to MCP Client
                    this.sendAvailableTools();
                    break;
                    
                case 'mcp-execute-tool':
                    // Execute tool requested by MCP Client
                    const { requestId, toolName, parameters } = event.data;
                    this.handleToolExecution(toolName, parameters, requestId);
                    break;
                    
                case 'request-tools-context':
                    // Respond with available tools
                    event.source.postMessage({
                        type: 'tools-context',
                        tools: this.getTools()
                    }, '*');
                    break;
                    
                default:
                    console.log('MCP Server: Unknown message type:', event.data.type);
            }
        });
    }

    async executeAddMedication(args, requestId = null) {
        console.log('MCP Server: executing addMedication with:', args);
        
        try {
            // Validate input
            const validatedArgs = medicationSchema.parse(args);
            
            // Validate required fields
            if (!validatedArgs.name || !validatedArgs.dose || !validatedArgs.frequency) {
                throw new Error("Missing required fields: name, dose, and frequency are required");
            }

            // Check for drug allergies
            const allergyMatch = this.localAllergies.find(allergy => 
                validatedArgs.name.toLowerCase().includes(allergy.allergen.toLowerCase()) ||
                allergy.allergen.toLowerCase().includes(validatedArgs.name.toLowerCase())
            );
            
            if (allergyMatch) {
                throw new Error(`Cannot add ${validatedArgs.name}: Patient is allergic to ${allergyMatch.allergen} (${allergyMatch.severity} reaction)`);
            }

            // Check if medication already exists
            const existingMed = this.localMedications.find(med => 
                med.name.toLowerCase() === validatedArgs.name.toLowerCase()
            );
            
            if (existingMed) {
                throw new Error(`Medication ${validatedArgs.name} is already in the patient's medication list`);
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
            
            // Send response to MCP Client via postMessage
            this.sendToolResponse('addMedication', {
                success: true,
                data: newMed,
                message: successMessage
            }, requestId);
            
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
            const errorMessage = error.message;
            
            // Send error response to MCP Client
            this.sendToolResponse('addMedication', {
                success: false,
                error: errorMessage
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    async executeEditMedication(args, requestId = null) {
        console.log('MCP Server: executing editMedication with:', args);
        
        try {
            const validatedArgs = editMedicationSchema.parse(args);
            
            // Find medication to edit
            const medIndex = this.localMedications.findIndex(med => 
                med.id === validatedArgs.medId || 
                med.name.toLowerCase() === validatedArgs.medId.toLowerCase()
            );
            
            if (medIndex === -1) {
                throw new Error(`Medication ${validatedArgs.medId} not found`);
            }
            
            // Update medication
            const updatedMed = { ...this.localMedications[medIndex], ...validatedArgs.updates };
            this.localMedications[medIndex] = updatedMed;
            
            const successMessage = `Successfully updated ${updatedMed.name}`;
            
            this.sendToolResponse('editMedication', {
                success: true,
                data: updatedMed,
                message: successMessage
            }, requestId);
            
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
            const errorMessage = error.message;
            
            this.sendToolResponse('editMedication', {
                success: false,
                error: errorMessage
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    async executeGetContext(args, requestId = null) {
        console.log('MCP Server: executing getContext');
        
        try {
            const context = this.getLocalContext();
            
            this.sendToolResponse('getContext', {
                success: true,
                data: context,
                message: 'Context retrieved successfully'
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(context, null, 2)
                    }
                ],
                isError: false
            };
            
        } catch (error) {
            const errorMessage = error.message;
            
            this.sendToolResponse('getContext', {
                success: false,
                error: errorMessage
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    async executeDiscontinueMedication(args, requestId = null) {
        console.log('MCP Server: executing discontinueMedication with:', args);
        
        try {
            const medId = args.medId || args;
            
            // Find medication to discontinue
            const medIndex = this.localMedications.findIndex(med => 
                med.id === medId || 
                med.name.toLowerCase() === medId.toLowerCase()
            );
            
            if (medIndex === -1) {
                throw new Error(`Medication ${medId} not found`);
            }
            
            const discontinuedMed = this.localMedications.splice(medIndex, 1)[0];
            
            const successMessage = `Successfully discontinued ${discontinuedMed.name}`;
            
            this.sendToolResponse('discontinueMedication', {
                success: true,
                data: discontinuedMed,
                message: successMessage
            }, requestId);
            
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
            const errorMessage = error.message;
            
            this.sendToolResponse('discontinueMedication', {
                success: false,
                error: errorMessage
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    async executeAddAllergy(args, requestId = null) {
        console.log('MCP Server: executing addAllergy with:', args);
        
        try {
            const validatedArgs = allergySchema.parse(args);
            
            // Check if allergy already exists
            const existingAllergy = this.localAllergies.find(allergy => 
                allergy.allergen.toLowerCase() === validatedArgs.allergen.toLowerCase()
            );
            
            if (existingAllergy) {
                throw new Error(`Allergy to ${validatedArgs.allergen} already exists`);
            }
            
            // Create new allergy
            const newAllergy = {
                id: `allergy-${Date.now()}`,
                allergen: validatedArgs.allergen,
                reaction: validatedArgs.reaction || "Not specified",
                severity: validatedArgs.severity || "Moderate"
            };
            
            this.localAllergies.push(newAllergy);
            
            const successMessage = `Successfully added allergy to ${validatedArgs.allergen}`;
            
            this.sendToolResponse('addAllergy', {
                success: true,
                data: newAllergy,
                message: successMessage
            }, requestId);
            
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
            const errorMessage = error.message;
            
            this.sendToolResponse('addAllergy', {
                success: false,
                error: errorMessage
            }, requestId);
            
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${errorMessage}`
                    }
                ],
                isError: true
            };
        }
    }

    // Send tool response to MCP Client (Ozwell iframe)
    sendToolResponse(toolName, result, requestId = null) {
        console.log(`MCP Server: Sending response for ${toolName}:`, result);
        
        // Send response to MCP Client via postMessage
        window.postMessage({
            type: 'mcp-tool-response',
            requestId: requestId,
            toolName: toolName,
            success: result.success,
            result: result.data,
            message: result.message,
            error: result.error,
            timestamp: new Date().toISOString()
        }, '*');
        
        // Also log the action for debugging
        console.log(`Medical action completed: ${toolName}`, result);
    }

    // Send available tools to MCP Client
    sendAvailableTools() {
        console.log('MCP Server: Sending available tools to MCP Client');
        
        // Create serializable version of tools (without Zod schemas)
        const serializableTools = this.toolsDefinition.map(tool => ({
            name: tool.name,
            description: tool.description
            // Note: inputSchema is excluded as it contains non-serializable Zod objects
        }));
        
        window.postMessage({
            type: 'mcp-tools-available',
            tools: serializableTools,
            timestamp: new Date().toISOString()
        }, '*');
    }

    // Handle tool execution request from MCP Client
    handleToolExecution(toolName, parameters, requestId) {
        console.log(`MCP Server: Handling tool execution request for ${toolName}:`, parameters);
        
        // Execute the tool and send response
        this.executeTool(toolName, parameters, requestId);
    }

    // Get current context including local medications and allergies
    getLocalContext() {
        return {
            patientInfo: this.patientInfo,
            medications: [...this.localMedications],
            allergies: [...this.localAllergies],
            totalMedications: this.localMedications.length,
            totalAllergies: this.localAllergies.length,
            lastUpdated: new Date().toISOString()
        };
    }

    async initialize() {
        console.log('Initializing Medical MCP Server...');
        
        // Initialize with some default data for testing
        this.localMedications = [
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
                startDate: "2024-02-01"
            }
        ];
        
        this.localAllergies = [
            {
                id: "allergy-1",
                allergen: "Penicillin",
                reaction: "Rash",
                severity: "Moderate"
            },
            {
                id: "allergy-2",
                allergen: "Sulfa",
                reaction: "Hives",
                severity: "Mild"
            }
        ];
        
        this.initialized = true;
        
        console.log('Medical MCP Server initialized successfully');
        console.log('Available tools:', this.toolsDefinition.map(t => t.name).join(', '));
        console.log('Sample data loaded - Medications:', this.localMedications.length, 'Allergies:', this.localAllergies.length);
        
        // Send initial tools to any listening MCP Client
        setTimeout(() => {
            this.sendAvailableTools();
        }, 500);
        
        return this;
    }

    isInitialized() {
        return this.initialized;
    }

    // Get available tools (for external access)
    getTools() {
        return this.toolsDefinition.map(tool => ({
            name: tool.name,
            description: tool.description
        }));
    }

    // Get detailed tool information
    getToolDetails() {
        return this.toolsDefinition;
    }

    // Reset medical data (for testing)
    resetData() {
        this.localMedications = [];
        this.localAllergies = [];
        console.log('MCP Server: Medical data reset');
    }

    // Get current medical data (for testing/debugging)
    getCurrentData() {
        return {
            medications: this.localMedications,
            allergies: this.localAllergies,
            patientInfo: this.patientInfo
        };
    }

    // Execute a tool directly (for testing)
    async executeTool(toolName, parameters, requestId = null) {
        try {
            let result;
            
            switch (toolName) {
                case "addMedication":
                    result = await this.executeAddMedication(parameters, requestId);
                    break;
                case "editMedication":
                    result = await this.executeEditMedication(parameters, requestId);
                    break;
                case "getContext":
                    result = await this.executeGetContext(parameters, requestId);
                    break;
                case "discontinueMedication":
                    result = await this.executeDiscontinueMedication(parameters, requestId);
                    break;
                case "addAllergy":
                    result = await this.executeAddAllergy(parameters, requestId);
                    break;
                default:
                    // Only for unknown tools, send error response
                    this.sendToolResponse(toolName, {
                        success: false,
                        error: `Unknown tool: ${toolName}`
                    }, requestId);
                    throw new Error(`Unknown tool: ${toolName}`);
            }
            
            // Individual execute methods handle their own responses
            // and include the requestId for proper response tracking
            
        } catch (error) {
            console.error(`Error executing tool ${toolName}:`, error);
            // Error responses are handled by individual execute methods
            // This catch mainly handles the unknown tool case above
        }
    }
}

// Export for use in MCP client
window.MedicalMCPServer = MedicalMCPServer;

// Auto-initialize and expose server instance
window.addEventListener('DOMContentLoaded', async () => {
    const server = new MedicalMCPServer();
    await server.initialize();
    window.medicationServer = server;
    
    console.log('Medical MCP Server is ready!');
    console.log('Available methods:');
    console.log('- window.medicationServer.getCurrentData() - View current data');
    console.log('- window.medicationServer.resetData() - Reset all data');
    console.log('- window.medicationServer.getTools() - Get available tools');
    console.log('- window.medicationServer.executeTool(toolName, parameters) - Execute a tool directly');
    
    // Example usage:
    console.log('Example: window.medicationServer.executeTool("addMedication", {name: "Aspirin", dose: "81mg", frequency: "once daily", indication: "Cardioprotection"})');
});
