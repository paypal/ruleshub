# Payment Token Creation (Server-Side)

**Official Documentation**: https://docs.paypal.ai/payments/save/sdk/paypal/js-sdk-v6-vault

## Overview

This guide shows how to create payment tokens from approved setup tokens on the server-side. Payment tokens represent saved customer payment methods that can be used for future purchases.

## API Endpoint Implementation

### Node.js/Express Implementation
```javascript
const express = require('express');
const router = express.Router();

// Create Payment Token Endpoint
router.post('/vault/payment-token/create', async (req, res) => {
  try {
    const { setupToken, customerId } = req.body;
    
    // Validate input
    if (!setupToken || !customerId) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Setup token and customer ID are required'
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
    
    // Create payment token from setup token
    const paymentToken = await createPaymentToken(accessToken, setupToken, customerId);
    
    // Store payment token securely in database
    await storePaymentToken(customerId, paymentToken);
    
    console.log('Payment token created successfully:', {
      customerId: customerId,
      paymentTokenId: paymentToken.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      id: paymentToken.id,
      status: paymentToken.status,
      customer: {
        id: customerId
      },
      payment_source: {
        paypal: {
          email_address: paymentToken.payment_source?.paypal?.email_address || null,
          account_id: paymentToken.payment_source?.paypal?.account_id || null
        }
      }
    });

  } catch (error) {
    console.error('Payment token creation failed:', error);
    
    // Extract PayPal Debug ID
    const debugId = error?.details?.[0]?.debug_id || 'N/A';
    console.log('PayPal Debug ID:', debugId);

    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create payment token',
      debugId: debugId
    });
  }
});

// Create Payment Token with PayPal API
async function createPaymentToken(accessToken, setupToken, customerId) {
  const paymentTokenUrl = `${getPayPalBaseUrl()}/v3/vault/payment-tokens`;
  
  const payload = {
    payment_source: {
      token: {
        id: setupToken,
        type: "SETUP_TOKEN"
      }
    },
    customer: {
      id: customerId
    }
  };

  try {
    const response = await fetch(paymentTokenUrl, {
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

    const paymentToken = await response.json();
    console.log('Payment token created:', paymentToken.id);
    
    return paymentToken;

  } catch (error) {
    console.error('Payment token creation failed:', error);
    throw error;
  }
}

// Store Payment Token Securely
async function storePaymentToken(customerId, paymentToken) {
  try {
    const encryptedToken = encryptPaymentToken(paymentToken.id);
    
    const tokenData = {
      customer_id: customerId,
      payment_token_id: encryptedToken,
      paypal_account_id: paymentToken.payment_source?.paypal?.account_id,
      email_address: paymentToken.payment_source?.paypal?.email_address,
      status: paymentToken.status,
      created_at: new Date(),
      last_used: null
    };

    // Store in your database - implement based on your database choice
    await db.query(`
      INSERT INTO customer_payment_tokens 
      (customer_id, payment_token_id, paypal_account_id, email_address, status, created_at, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tokenData.customer_id,
      tokenData.payment_token_id,
      tokenData.paypal_account_id,
      tokenData.email_address,
      tokenData.status,
      tokenData.created_at,
      tokenData.last_used
    ]);

    console.log('Payment token stored in database:', customerId);

  } catch (error) {
    console.error('Failed to store payment token:', error);
    throw new Error('Failed to save payment method');
  }
}

// Encrypt Payment Token (implement with your encryption method)
function encryptPaymentToken(paymentTokenId) {
  // Implement proper encryption using your preferred method
  // Example using Node.js crypto module
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.PAYMENT_TOKEN_ENCRYPTION_KEY;
  
  if (!secretKey) {
    throw new Error('Payment token encryption key not configured');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, secretKey);
  
  let encrypted = cipher.update(paymentTokenId, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return base64 encoded: iv + authTag + encrypted
  return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
}

// Decrypt Payment Token (for retrieval)
function decryptPaymentToken(encryptedToken) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-gcm';
  const secretKey = process.env.PAYMENT_TOKEN_ENCRYPTION_KEY;
  
  const buffer = Buffer.from(encryptedToken, 'base64');
  const iv = buffer.slice(0, 16);
  const authTag = buffer.slice(16, 32);
  const encrypted = buffer.slice(32);
  
  const decipher = crypto.createDecipher(algorithm, secretKey);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
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
  try {
    // Implement your customer validation logic
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
  return `payment-token-${Date.now()}-${Math.random().toString(36).substring(2)}`;
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
from cryptography.fernet import Fernet
import base64

vault_bp = Blueprint('vault', __name__)

@vault_bp.route('/vault/payment-token/create', methods=['POST'])
def create_payment_token():
    try:
        data = request.get_json()
        setup_token = data.get('setupToken')
        customer_id = data.get('customerId')
        
        # Validate input
        if not setup_token or not customer_id:
            return jsonify({
                'error': 'VALIDATION_ERROR',
                'message': 'Setup token and customer ID are required'
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
        
        # Create payment token
        payment_token = create_paypal_payment_token(access_token, setup_token, customer_id)
        
        # Store payment token securely
        store_payment_token(customer_id, payment_token)
        
        print(f'Payment token created successfully: {customer_id} -> {payment_token["id"]}')

        return jsonify({
            'id': payment_token['id'],
            'status': payment_token['status'],
            'customer': {'id': customer_id},
            'payment_source': {
                'paypal': {
                    'email_address': payment_token.get('payment_source', {}).get('paypal', {}).get('email_address'),
                    'account_id': payment_token.get('payment_source', {}).get('paypal', {}).get('account_id')
                }
            }
        })

    except Exception as error:
        print(f'Payment token creation failed: {error}')
        
        debug_id = getattr(error, 'debug_id', 'N/A')
        print(f'PayPal Debug ID: {debug_id}')

        return jsonify({
            'error': 'INTERNAL_SERVER_ERROR',
            'message': 'Failed to create payment token',
            'debugId': debug_id
        }), 500

def create_paypal_payment_token(access_token, setup_token, customer_id):
    payment_token_url = f"{get_paypal_base_url()}/v3/vault/payment-tokens"
    
    payload = {
        'payment_source': {
            'token': {
                'id': setup_token,
                'type': 'SETUP_TOKEN'
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
        response = requests.post(payment_token_url, json=payload, headers=headers)
        
        if not response.ok:
            error_data = response.text
            print(f'PayPal API error: {response.status_code} {error_data}')
            raise Exception(f'PayPal API Error: {response.status_code}')

        payment_token = response.json()
        print(f'Payment token created: {payment_token["id"]}')
        
        return payment_token

    except Exception as error:
        print(f'Payment token creation failed: {error}')
        raise error

def store_payment_token(customer_id, payment_token):
    try:
        encrypted_token = encrypt_payment_token(payment_token['id'])
        
        token_data = {
            'customer_id': customer_id,
            'payment_token_id': encrypted_token,
            'paypal_account_id': payment_token.get('payment_source', {}).get('paypal', {}).get('account_id'),
            'email_address': payment_token.get('payment_source', {}).get('paypal', {}).get('email_address'),
            'status': payment_token['status'],
            'created_at': datetime.now(),
            'last_used': None
        }

        # Store in database - implement based on your database choice
        # db.execute("""
        #     INSERT INTO customer_payment_tokens 
        #     (customer_id, payment_token_id, paypal_account_id, email_address, status, created_at, last_used)
        #     VALUES (?, ?, ?, ?, ?, ?, ?)
        # """, [
        #     token_data['customer_id'],
        #     token_data['payment_token_id'],
        #     token_data['paypal_account_id'],
        #     token_data['email_address'],
        #     token_data['status'],
        #     token_data['created_at'],
        #     token_data['last_used']
        # ])

        print(f'Payment token stored in database: {customer_id}')

    except Exception as error:
        print(f'Failed to store payment token: {error}')
        raise Exception('Failed to save payment method')

def encrypt_payment_token(payment_token_id):
    # Implement proper encryption
    encryption_key = os.getenv('PAYMENT_TOKEN_ENCRYPTION_KEY')
    if not encryption_key:
        raise Exception('Payment token encryption key not configured')
    
    # Use Fernet for symmetric encryption
    key = base64.urlsafe_b64encode(encryption_key.encode()[:32].ljust(32, b'0'))
    f = Fernet(key)
    
    encrypted = f.encrypt(payment_token_id.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_payment_token(encrypted_token):
    encryption_key = os.getenv('PAYMENT_TOKEN_ENCRYPTION_KEY')
    key = base64.urlsafe_b64encode(encryption_key.encode()[:32].ljust(32, b'0'))
    f = Fernet(key)
    
    encrypted_bytes = base64.b64decode(encrypted_token.encode())
    decrypted = f.decrypt(encrypted_bytes)
    return decrypted.decode()

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
    try:
        # Implement your customer validation logic
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None
            
        # Validate customer authentication and authorization
        return {'id': customer_id}  # Placeholder
        
    except Exception as error:
        print(f'Customer validation failed: {error}')
        return None

def get_paypal_base_url():
    environment = os.getenv('PAYPAL_ENVIRONMENT', 'sandbox')
    return 'https://api-m.paypal.com' if environment == 'live' else 'https://api-m.sandbox.paypal.com'

def generate_idempotency_key():
    return f"payment-token-{int(time.time())}-{''.join(random.choices(string.ascii_lowercase, k=8))}"
```

## Database Schema

### SQL Table for Payment Tokens
```sql
CREATE TABLE customer_payment_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    payment_token_id TEXT NOT NULL, -- Encrypted
    paypal_account_id VARCHAR(255),
    email_address VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

## Environment Variables Required

```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENVIRONMENT=sandbox

# Encryption Configuration
PAYMENT_TOKEN_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

## API Response Format

### Success Response (201 Created)
```json
{
  "id": "8AB12345678901234",
  "status": "CREATED",
  "customer": {
    "id": "customer_123"
  },
  "payment_source": {
    "paypal": {
      "email_address": "customer@example.com",
      "account_id": "ABC123456789"
    }
  }
}
```

### Error Response (400/401/500)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Setup token and customer ID are required",
  "debugId": "7c123456789abcdef"
}
```

## Security Considerations

- **Always encrypt payment tokens** before storing in database
- **Validate setup token ownership** before creating payment tokens
- **Implement proper customer authentication** and authorization
- **Use strong encryption keys** (32+ characters, securely stored)
- **Log all vault operations** for audit and compliance
- **Implement token cleanup** for deleted customer accounts
- **Validate payment token uniqueness** per customer
- **Use HTTPS only** for all communications

## Testing

Test with PayPal sandbox:

1. Create setup token using previous snippet
2. Complete setup token approval flow
3. Create payment token from approved setup token
4. Verify token storage in database
5. Test encryption/decryption functionality
6. Test error scenarios (invalid setup token, expired tokens)

## Common Issues

- **Invalid setup token**: Ensure setup token was properly approved
- **Encryption errors**: Check encryption key configuration
- **Database constraints**: Verify table schema and indexes
- **Customer validation fails**: Ensure proper authentication
- **Token already exists**: Handle duplicate payment tokens gracefully