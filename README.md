# Medical MCP Postmessage Application

## Current State: Ozwell Integration Status

### ❌ **No Real Ozwell API Integration**

Currently, this application does **NOT** have actual Ozwell API integration. What you have is:

1. **Local simulation only** - All "Ozwell" functionality is mocked
2. **Missing API calls** - No HTTP requests to real Ozwell endpoints
3. **Incomplete implementation** - Several methods are called but not implemented

### 🏗️ **What Exists (Local Simulation)**

- ✅ MCP Server with medical tools (add medication, allergies, etc.)
- ✅ PostMessage communication between iframe and parent
- ✅ Local medical data management
- ✅ Chat UI interface
- ✅ Tool execution framework

### 🚫 **What's Missing for Real Ozwell Integration**

#### 1. **API Configuration**
```javascript
// You need real Ozwell API credentials
const ozwellConfig = {
    apiUrl: 'https://api.ozwell.com', // Real Ozwell API URL
    apiKey: 'your-actual-api-key',    // Real API key
    model: 'ozwell-medical-model'     // Real model name
};
```

#### 2. **API Implementation**
The following methods in `ozwell-integration.js` need real implementation:
- `generateResponse()` - Make HTTP calls to Ozwell chat API
- `parseToolCalls()` - Parse Ozwell's tool call format
- `formatResponse()` - Format Ozwell responses for display

#### 3. **Authentication**
- Obtain Ozwell API credentials
- Implement proper API authentication
- Handle API rate limits and errors

#### 4. **Medical Model Integration**
- Configure Ozwell medical model
- Set up medical-specific prompts and context
- Implement medical safety guardrails

## 🔧 **How to Add Real Ozwell Integration**

### Step 1: Get Ozwell API Access
1. Sign up for Ozwell API access
2. Obtain API key and model information
3. Review Ozwell's medical API documentation

### Step 2: Update Configuration
```javascript
// Update agent-iframe/ozwell-config.js
export const OzwellConfig = {
    apiUrl: 'https://api.ozwell.com',  // Real URL
    apiKey: 'your-real-api-key',       // Real API key
    model: 'ozwell-medical-v1'         // Real model name
};
```

### Step 3: Implement API Calls
The `ozwell-integration.js` file has been updated with a template for real API integration. You need to:

1. **Replace the API URL and authentication**
2. **Implement proper error handling**
3. **Add medical context to API calls**
4. **Handle streaming responses**

### Step 4: Test Integration
```bash
# Start the development server
npm run dev

# Test API calls in browser console
```

## 📁 **Current Architecture**

```
agent-iframe/               # Medical AI chat interface
├── ozwell-integration.js  # Ozwell API integration (needs real implementation)
├── ozwell-config.js       # API configuration
├── medical-mcp-server.js  # MCP server with medical tools
├── mcp-client.js          # Chat client and UI management
└── index.html             # Chat interface

parent-app/                # Medical practice simulation
├── medical-data.js        # Local medical data management
├── ozwell-agent-sim.js    # Iframe management and communication
└── index.html             # Practice management interface
```

## 🚀 **To Run Current Application**

```bash
# Install dependencies
npm install

# Start development server (Vite)
npm run dev

# Or use http-server for simple static serving
npx http-server -p 8080 -c-1
```

Access:
- Parent app: `http://localhost:3000/parent-app/`
- Agent iframe: `http://localhost:3000/agent-iframe/`

## ⚠️ **Important Notes**

1. **This is currently a proof-of-concept** with local simulation only
2. **No real AI or Ozwell integration** exists yet
3. **Medical data is simulated** for demonstration purposes
4. **Not suitable for production** medical use without proper integration

## 🎯 **Next Steps**

1. **Obtain Ozwell API credentials**
2. **Implement real API calls** in `ozwell-integration.js`
3. **Add proper error handling** and rate limiting
4. **Test with real medical scenarios**
5. **Add medical safety and compliance features**

## Environment Configuration

### API Keys Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Add your API credentials to `.env`:**
   ```env
   OZWELL_API_KEY=your_actual_api_key_here
   OZWELL_BASE_URL=https://ai.bluehive.com/api/v1/completion
   OZWELL_MODEL=ozwell-medical-v1
   FORCE_SIMULATION_MODE=false
   ```

3. **The `.env` file is automatically loaded by the application**
   - The API key will be fetched from the environment variable
   - Fallback to hardcoded values if `.env` file is not available
   - Never commit the `.env` file to version control (it's in `.gitignore`)

### Security Notes
- Keep your API keys secure and never commit them to version control
- Use `.env.example` as a template for other developers
- The application will fall back to hardcoded values if environment loading fails
