import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Medical MCP Server implementation
export class MedicalMCPServer {
    constructor() {
        const medicationSchema = z.object({
            name: z.string().describe("Name of the medication"),
            frequency: z.string().describe("How often to take the medication"),
            indication: z.string().describe("Reason for prescribing")
        });

        const allergySchema = z.object({
            allergen: z.string().describe("The substance the patient is allergic to"),
            reaction: z.string().describe("The type of reaction"),
            severity: z.enum(["Mild", "Moderate", "Severe"]).describe("Severity of the allergic reaction")
        });

        this.server = new McpServer({
            name: "medical-server",
            version: "1.0.0",
            capabilities: {
                resources: {},
                tools: {
                    addMedication: {
                        description: "Add a new medication to patient records",
                        parameters: medicationSchema,
                        handler: async (params, context) => {
                            // Validate against context (allergies, interactions)
                            if (context?.allergies) {
                                const allergyMatch = context.allergies.find(a => 
                                    params.name.toLowerCase().includes(a.allergen.toLowerCase())
                                );
                                if (allergyMatch) {
                                    throw new Error(`Patient is allergic to ${allergyMatch.allergen}`);
                                }
                            }
                            
                            return window.parent.postMessage({
                                type: 'mcp-tool-call',
                                tool: 'addMedication',
                                params
                            }, '*');
                        }
                    },
                    discontinueMedication: {
                        description: "Discontinue an existing medication",
                        parameters: z.string().describe("Name or ID of medication to discontinue"),
                        handler: async (params, context) => {
                            // Validate medication exists
                            if (context?.medications) {
                                const exists = context.medications.some(m => 
                                    m.name.toLowerCase() === params.toLowerCase() || m.id === params
                                );
                                if (!exists) {
                                    throw new Error(`Medication ${params} not found in current medications`);
                                }
                            }
                            
                            return window.parent.postMessage({
                                type: 'mcp-tool-call',
                                tool: 'discontinueMedication',
                                params
                            }, '*');
                        }
                    },
                    addAllergy: {
                        description: "Add a new allergy to patient records",
                        parameters: allergySchema,
                        handler: async (params) => {
                            return window.parent.postMessage({
                                type: 'mcp-tool-call',
                                tool: 'addAllergy',
                                params
                            }, '*');
                        }
                    },
                    getContext: {
                        description: "Get current patient context",
                        parameters: z.object({}),
                        handler: async () => {
                            return window.parent.postMessage({
                                type: 'mcp-tool-call',
                                tool: 'getContext',
                                params: {}
                            }, '*');
                        }
                    }
                }
            }
        });
    }

    async initialize() {
        // Set up message listener for tool responses
        window.addEventListener('message', this.handleMessage.bind(this));
        
        await this.server.initialize();

        // Register with parent
        window.parent.postMessage({
            type: 'mcp-register',
            capabilities: Object.keys(this.server.capabilities.tools)
        }, '*');

        return this;
    }

    handleMessage(event) {
        const { data } = event;
        if (data.type === 'mcp-tool-response') {
            // Handle tool response through MCP server
            this.server.handleToolResponse(data.requestId, data.result);
        }
    }

    async executeTool(toolName, parameters, context = null) {
        return await this.server.executeTool(toolName, parameters, context);
    }
}
