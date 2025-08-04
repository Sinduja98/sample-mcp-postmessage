// Medical MCP Server - Mock implementation for local development
class MedicalMCPServer {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        // Mock initialization - in a real implementation this would
        // connect to actual MCP server endpoints
        console.log('Initializing Medical MCP Server (mock)...');
        
        // Simulate async initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.initialized = true;
        console.log('Medical MCP Server initialized successfully');
        
        return this;
    }

    isInitialized() {
        return this.initialized;
    }

    // Mock method for compatibility
    async getContext() {
        console.log('MedicalMCPServer.getContext() - delegating to parent communication');
        // This is handled via postMessage to parent, so just return mock success
        return { success: true, message: 'Using parent communication' };
    }
}

// Export for use in MCP client
window.MedicalMCPServer = MedicalMCPServer;
