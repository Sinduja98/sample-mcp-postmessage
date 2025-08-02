// Main entry point for agent iframe
import { MCPClient } from './mcp-client.js';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create and initialize the MCPClient
        window.mcpClient = await new MCPClient().initialize();
        
        // Update status indicator
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText && statusDot) {
            statusText.textContent = 'Connected';
            statusDot.classList.add('connected');
        }

        console.log('MCP Client initialized successfully');
    } catch (error) {
        console.error('Error initializing MCP client:', error);
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        if (statusText && statusDot) {
            statusText.textContent = 'Error connecting';
            statusDot.classList.add('error');
        }
    }
});
