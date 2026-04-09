# Client Token Generation (Server-Side)

## v6 Server-Side Implementation

### Express.js Implementation

```javascript
// server.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// PayPal Configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

let cachedToken = null;
let tokenExpiration = null;

/**
 * Generate browser-safe client token from PayPal
 * This token is used to initialize the PayPal v6 SDK in the browser
 */
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    // Check if we have a cached token that's still valid
    if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
      console.log('Returning cached client token');
      return res.json({
        accessToken: cachedToken,
        expiresIn: Math.floor((tokenExpiration - Date.now()) / 1000)
      });
    }

    // Generate new token from PayPal
    console.log('Generating new client token from PayPal');
    
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials&response_type=client_token&intent=sdk_init',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;
    
    // Cache the token with buffer time for safety
    cachedToken = access_token;
    tokenExpiration = Date.now() + ((expires_in - 120) * 1000); // 2 minutes buffer

    console.log('Client token generated successfully');
    res.json({
      accessToken: access_token,
      expiresIn: expires_in
    });

  } catch (error) {
    console.error('Error generating client token:', {
      message: error.message,
      response: error.response?.data,
      debugId: error.response?.headers?.['paypal-debug-id']
    });

    res.status(error.response?.status || 500).json({
      error: 'TOKEN_GENERATION_FAILED',
      message: 'Failed to generate client token',
      debugId: error.response?.headers?.['paypal-debug-id']
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${PAYPAL_ENVIRONMENT}`);
});
```

### Node.js with Fetch API (Native)

```javascript
// server.js
import dotenv from 'dotenv';

dotenv.config();

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Token cache
let cachedToken = null;
let tokenExpiration = null;

/**
 * Generate client token with caching
 */
async function generateClientToken() {
  try {
    // Return cached token if still valid
    if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
      return cachedToken;
    }

    // Generate new token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&response_type=client_token&intent=sdk_init'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PayPal API error: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    
    // Cache token
    cachedToken = data.access_token;
    tokenExpiration = Date.now() + ((data.expires_in - 120) * 1000);

    return cachedToken;

  } catch (error) {
    console.error('Error generating client token:', error);
    throw error;
  }
}

// Export for use in route handlers
export { generateClientToken };
```

### Environment Variables (.env)

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_ENVIRONMENT=sandbox  # or 'live' for production

# Server Configuration
PORT=3000
```

## Client-Side Usage

```javascript
// client.js
async function getBrowserSafeClientToken() {
  try {
    const response = await fetch('/paypal-api/auth/browser-safe-client-token');
    
    // IMPORTANT: Always validate content-type before parsing JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error('Expected JSON response, got HTML error page');
    }

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
    }

    const { accessToken } = await response.json();
    return accessToken;

  } catch (error) {
    console.error('Failed to fetch client token:', error);
    throw error;
  }
}

// Usage in SDK initialization
async function initializePayPalSDK() {
  try {
    const clientToken = await getBrowserSafeClientToken();
    
    const sdkInstance = await window.paypal.createInstance({
      clientToken,
      components: ["paypal-payments"],
      pageType: "checkout"
    });

    console.log('PayPal SDK initialized successfully');
    return sdkInstance;

  } catch (error) {
    console.error('SDK initialization failed:', error);
    throw error;
  }
}
```

## Security Checklist

- Client secret is stored in environment variables (not in code)
- Client secret is NEVER exposed to frontend
- HTTPS is used for all API communication
- Response content-type is validated before parsing
- Errors are logged with PayPal debug IDs
- Token caching is implemented to reduce API calls
- Tokens are cached with appropriate buffer time for safety
- Proper error handling with user-friendly messages

## Common Issues & Solutions

### Issue: "AUTHENTICATION_FAILURE" error
**Cause**: Invalid client_id or client_secret  
**Solution**: Verify credentials in PayPal Developer Dashboard

### Issue: "Unexpected token '<' in JSON"
**Cause**: Server returning HTML error page instead of JSON  
**Solution**: Validate content-type header before parsing JSON

### Issue: Frequent token generation calls
**Cause**: Not caching tokens properly  
**Solution**: Implement token caching with 13-14 minute duration

### Issue: Works in sandbox but fails in production
**Cause**: Using sandbox credentials in production  
**Solution**: Use separate credentials for sandbox and production environments

## Testing

```javascript
// Test token generation
async function testTokenGeneration() {
  try {
    const token = await getBrowserSafeClientToken();
    console.log('Token generated successfully');
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 20) + '...');
    
    // Test token with SDK
    const sdkInstance = await window.paypal.createInstance({
      clientToken: token,
      components: ["paypal-payments"]
    });
    console.log('SDK initialized with token successfully');
    
  } catch (error) {
    console.error('Token generation test failed:', error);
  }
}
```

## Migration Notes

**v5 Pattern:**
```html
<!-- Client ID exposed in browser -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID"></script>
```

**v6 Pattern:**
```javascript
// Server generates token, client receives it
const clientToken = await fetch('/paypal-api/auth/browser-safe-client-token');
await window.paypal.createInstance({ clientToken, ... });
```

**Key Changes:**
- Client credentials never exposed to browser
- Time-limited tokens with proper expiration handling
- Domain-bound tokens
- Server-side validation required

