# Setup Token Creation (Server-Side)

**Official Documentation**: https://docs.paypal.ai/payments/save/sdk/paypal/js-sdk-v6-vault

## Overview

This guide shows how to create setup tokens on the server-side for PayPal v6 SDK vault operations. Setup tokens are used to initiate the save payment flow without requiring a purchase.

## API Endpoint Implementation

### Node.js/Express Implementation
```javascript
const express = require('express');
const router = express.Router();

// Create Setup Token Endpoint
router.post('/vault/setup-token/create', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    // Validate input
    if (!customerId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Customer ID is required'
      });
    }

    // Validate customer exists and is authenticated
    const customer = await validateCustomer(customerId, req);
    if (!customer) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or unauthorized customer'
      });
    }

    // Generate PayPal access token
    const accessToken = await getPayPalAccessToken();
    
    // Create setup token
    const setupToken = await createSetupToken(accessToken, customerId);
    
    console.log('Setup token created successfully:', {
      customerId: customerId,
      setupTokenId: setupToken.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      id: setupToken.id,
      status: setupToken.status,
      customer: {
        id: customerId
      },
      links: setupToken.links
    });

  } catch (error) {
    console.error('Setup token creation failed:', error);
    
    // Extract PayPal Debug ID
    const debugId = error?.details?.[0]?.debug_id || 'N/A';
    console.log('PayPal Debug ID:', debugId);

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create setup token',
      debugId: debugId
    });
  }
});

// Create Setup Token with PayPal API
async function createSetupToken(accessToken, customerId) {
  const setupTokenUrl = `${getPayPalBaseUrl()}/v3/vault/setup-tokens`;
  
  const payload = {
    payment_source: {
      paypal: {
        description: "Save PayPal account for future payments",
        shipping: {
          name: {
            full_name: "Customer Name" // Optional: get from customer data
          },
          address: {
            address_line_1: "123 Main St", // Optional: get from customer data
            admin_area_2: "Anytown",
            admin_area_1: "CA",
            postal_code: "12345",
            country_code: "US"
          }
        },
        experience_context: {
          return_url: `${process.env.BASE_URL}/vault/setup/return`,
          cancel_url: `${process.env.BASE_URL}/vault/setup/cancel`,
          brand_name: "Your Store Name",
          locale: "en-US",
          shipping_preference: "GET_FROM_FILE"
        }
      }
    },
    customer: {
      id: customerId
    }
  };

  try {
    const response = await fetch(setupTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': generateIdempotencyKey(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('PayPal API error:', response.status, errorData);
      
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        parsedError = { message: errorData };
      }
      
      throw new Error(`PayPal API Error: ${response.status} - ${parsedError.message || 'Unknown error'}`);
    }

    const setupToken = await response.json();
    console.log('Setup token created:', setupToken.id);
    
    return setupToken;

  } catch (error) {
    console.error('Setup token creation failed:', error);
    throw error;
  }
}

// Get PayPal Access Token
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenUrl = `${getPayPalBaseUrl()}/v1/oauth2/token`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;

  } catch (error) {
    console.error('Access token generation failed:', error);
    throw new Error('PayPal authentication failed');
  }
}

// Validate Customer
async function validateCustomer(customerId, req) {
  // Implement your customer validation logic
  // This should verify:
  // 1. Customer exists in your database
  // 2. Customer is authenticated (check session/JWT)
  // 3. Customer has permission to save payment methods
  
  try {
    // Example implementation - replace with your logic
    const authenticatedUserId = req.user?.id; // From your auth middleware
    
    if (!authenticatedUserId) {
      throw new Error('User not authenticated');
    }
    
    if (customerId !== authenticatedUserId) {
      throw new Error('Customer ID mismatch');
    }
    
    // Query your database
    const customer = await db.query('SELECT * FROM customers WHERE id = ?', [customerId]);
    
    if (!customer || customer.length === 0) {
      throw new Error('Customer not found');
    }
    
    return customer[0];

  } catch (error) {
    console.error('Customer validation failed:', error);
    return null;
  }
}

// Helper Functions
function getPayPalBaseUrl() {
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
  return environment === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

function generateIdempotencyKey() {
  return `setup-token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
}

module.exports = router;
```

### Python/Flask Implementation
```python
from flask import Blueprint, request, jsonify
import requests
import os
import time
import random
import string
from datetime import datetime

vault_bp = Blueprint('vault', __name__)

@vault_bp.route('/vault/setup-token/create', methods=['POST'])
def create_setup_token():
    try:
        data = request.get_json()
        customer_id = data.get('customerId')
        
        # Validate input
        if not customer_id:
            return jsonify({
                'error': 'VALIDATION_ERROR',
                'message': 'Customer ID is required'
            }), 400

        # Validate customer
        customer = validate_customer(customer_id, request)
        if not customer:
            return jsonify({
                'error': 'UNAUTHORIZED',
                'message': 'Invalid or unauthorized customer'
            }), 401

        # Get PayPal access token
        access_token = get_paypal_access_token()
        
        # Create setup token
        setup_token = create_paypal_setup_token(access_token, customer_id)
        
        print(f'Setup token created successfully: {customer_id} -> {setup_token["id"]}')

        return jsonify({
            'id': setup_token['id'],
            'status': setup_token['status'],
            'customer': {'id': customer_id},
            'links': setup_token['links']
        })

    except Exception as error:
        print(f'Setup token creation failed: {error}')
        
        debug_id = getattr(error, 'debug_id', 'N/A')
        print(f'PayPal Debug ID: {debug_id}')

        return jsonify({
            'error': 'INTERNAL_SERVER_ERROR',
            'message': 'Failed to create setup token',
            'debugId': debug_id
        }), 500

def create_paypal_setup_token(access_token, customer_id):
    setup_token_url = f"{get_paypal_base_url()}/v3/vault/setup-tokens"
    
    payload = {
        'payment_source': {
            'paypal': {
                'description': 'Save PayPal account for future payments',
                'experience_context': {
                    'return_url': f"{os.getenv('BASE_URL')}/vault/setup/return",
                    'cancel_url': f"{os.getenv('BASE_URL')}/vault/setup/cancel",
                    'brand_name': 'Your Store Name',
                    'locale': 'en-US',
                    'shipping_preference': 'GET_FROM_FILE'
                }
            }
        },
        'customer': {
            'id': customer_id
        }
    }

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}',
        'PayPal-Request-Id': generate_idempotency_key(),
        'Prefer': 'return=representation'
    }

    try:
        response = requests.post(setup_token_url, json=payload, headers=headers)
        
        if not response.ok:
            error_data = response.text
            print(f'PayPal API error: {response.status_code} {error_data}')
            raise Exception(f'PayPal API Error: {response.status_code}')

        setup_token = response.json()
        print(f'Setup token created: {setup_token["id"]}')
        
        return setup_token

    except Exception as error:
        print(f'Setup token creation failed: {error}')
        raise error

def get_paypal_access_token():
    client_id = os.getenv('PAYPAL_CLIENT_ID')
    client_secret = os.getenv('PAYPAL_CLIENT_SECRET')
    
    if not client_id or not client_secret:
        raise Exception('PayPal credentials not configured')

    import base64
    auth = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
    token_url = f"{get_paypal_base_url()}/v1/oauth2/token"

    headers = {
        'Authorization': f'Basic {auth}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    try:
        response = requests.post(token_url, 
                               data='grant_type=client_credentials', 
                               headers=headers)
        
        if not response.ok:
            raise Exception(f'Token request failed: {response.status_code}')

        data = response.json()
        return data['access_token']

    except Exception as error:
        print(f'Access token generation failed: {error}')
        raise Exception('PayPal authentication failed')

def validate_customer(customer_id, request):
    # Implement your customer validation logic
    # This should verify the customer exists and is authenticated
    try:
        # Example - replace with your authentication logic
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
            
        # Validate JWT token or session
        # user_id = validate_jwt_token(auth_header)
        # if user_id != customer_id:
        #     return None
            
        # Query database for customer
        # customer = db.query('SELECT * FROM customers WHERE id = %s', [customer_id])
        # return customer[0] if customer else None
        
        return {'id': customer_id}  # Placeholder
        
    except Exception as error:
        print(f'Customer validation failed: {error}')
        return None

def get_paypal_base_url():
    environment = os.getenv('PAYPAL_ENVIRONMENT', 'sandbox')
    return 'https://api-m.paypal.com' if environment == 'live' else 'https://api-m.sandbox.paypal.com'

def generate_idempotency_key():
    return f"setup-token-{int(time.time())}-{''.join(random.choices(string.ascii_lowercase, k=8))}"
```

## Environment Variables Required

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENVIRONMENT=sandbox  # or 'live' for production

# Application Configuration
BASE_URL=https://your-domain.com
```

## API Response Format

### Success Response (201 Created)
```json
{
  "id": "7MY12345678901234",
  "status": "CREATED",
  "customer": {
    "id": "customer_123"
  },
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v3/vault/setup-tokens/7MY12345678901234",
      "rel": "self",
      "method": "GET"
    },
    {
      "href": "https://www.sandbox.paypal.com/agreements/approve?ba_token=7MY12345678901234",
      "rel": "approve",
      "method": "GET"
    }
  ]
}
```

### Error Response (400/401/500)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Customer ID is required",
  "debugId": "7c123456789abcdef"
}
```

## Security Considerations

- **Always validate customer authentication** before creating setup tokens
- **Use HTTPS only** for all API communications
- **Implement rate limiting** to prevent abuse
- **Log all vault operations** for audit purposes
- **Generate unique idempotency keys** for each request
- **Never expose setup tokens** to unauthorized users
- **Validate customer ownership** of the vault request

## Testing

Test with PayPal sandbox:

1. Use sandbox client credentials
2. Create test customer accounts
3. Test setup token creation
4. Verify token approval flow
5. Test error scenarios (invalid customer, network failures)

## Common Issues

- **401 Unauthorized**: Check PayPal client credentials
- **400 Bad Request**: Validate request payload format
- **Customer validation fails**: Ensure proper authentication middleware
- **Missing environment variables**: Check .env configuration
- **Network timeouts**: Implement proper retry logic