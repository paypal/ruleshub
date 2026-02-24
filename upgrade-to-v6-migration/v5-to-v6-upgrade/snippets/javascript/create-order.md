# Create Order (Server-Side)

## v6 Server Implementation

### Express.js Implementation

```javascript
// server.js
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/**
 * Get PayPal OAuth access token
 * This is different from the browser-safe client token
 */
async function getPayPalAccessToken() {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data);
    throw error;
  }
}

/**
 * Create PayPal order
 * POST /paypal-api/checkout/orders/create
 */
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    // Extract and validate order data
    const { 
      amount, 
      currency = 'USD',
      items = [],
      custom_id,
      invoice_id,
      description
    } = req.body;

    // CRITICAL: Always validate amount server-side
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Invalid or missing amount'
      });
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();

    // Build order payload
    // v5 equivalent: actions.order.create({ purchase_units: [...] })
    const orderPayload = {
      intent: 'CAPTURE', // or 'AUTHORIZE' for two-step payments
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: parseFloat(amount).toFixed(2), // Ensure 2 decimal places
            breakdown: items.length > 0 ? {
              item_total: {
                currency_code: currency,
                value: parseFloat(amount).toFixed(2)
              }
            } : undefined
          },
          description: description || 'Purchase',
          custom_id: custom_id || undefined,
          invoice_id: invoice_id || undefined,
          items: items.length > 0 ? items.map(item => ({
            name: item.name,
            quantity: item.quantity || '1',
            unit_amount: {
              currency_code: currency,
              value: parseFloat(item.price).toFixed(2)
            },
            sku: item.sku || undefined,
            description: item.description || undefined
          })) : undefined
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Your Store Name',
            locale: 'en-US',
            landing_page: 'LOGIN', // or 'BILLING' or 'NO_PREFERENCE'
            shipping_preference: 'NO_SHIPPING', // or 'SET_PROVIDED_ADDRESS' or 'GET_FROM_FILE'
            user_action: 'PAY_NOW', // Show 'Pay Now' button in PayPal
            return_url: `${req.protocol}://${req.get('host')}/success`,
            cancel_url: `${req.protocol}://${req.get('host')}/cancel`
          }
        }
      }
    };

    console.log('Creating PayPal order:', JSON.stringify(orderPayload, null, 2));

    // Call PayPal Orders API
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      orderPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(), // Idempotency key
        },
      }
    );

    const order = response.data;
    
    console.log('Order created successfully:', {
      id: order.id,
      status: order.status
    });

    // Return order details to client
    res.json({
      id: order.id,
      status: order.status,
      links: order.links
    });

  } catch (error) {
    console.error('Error creating order:', {
      message: error.message,
      response: error.response?.data,
      debugId: error.response?.headers?.['paypal-debug-id']
    });

    res.status(error.response?.status || 500).json({
      error: 'ORDER_CREATION_FAILED',
      message: error.response?.data?.message || 'Failed to create order',
      debugId: error.response?.headers?.['paypal-debug-id'],
      details: error.response?.data?.details
    });
  }
});
```

### Node.js with Fetch (Native)

```javascript
// orders.js

/**
 * Create PayPal order using native fetch
 */
export async function createPayPalOrder(orderData) {
  try {
    // Validate amount
    const amount = parseFloat(orderData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();

    // Build order payload
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: orderData.currency || 'USD',
            value: amount.toFixed(2)
          },
          description: orderData.description || 'Purchase'
        }
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            user_action: 'PAY_NOW',
            return_url: orderData.return_url,
            cancel_url: orderData.cancel_url
          }
        }
      }
    };

    // Create order
    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`PayPal API error: ${error.message}`);
    }

    const order = await response.json();
    return order;

  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
}
```

### Simple Order Creation (Minimal)

```javascript
/**
 * Minimal order creation for quick testing
 * POST /paypal-api/checkout/orders/create
 */
app.post('/paypal-api/checkout/orders/create', async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();
    
    // Simple order with just amount
    const { amount = '10.00', currency = 'USD' } = req.body;
    
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount
          }
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    res.json({ id: response.data.id, status: response.data.status });

  } catch (error) {
    console.error('Order creation failed:', error.response?.data);
    res.status(500).json({
      error: 'ORDER_CREATION_FAILED',
      debugId: error.response?.headers?.['paypal-debug-id']
    });
  }
});
```

## Order Payload Examples

### Basic Order

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "amount": {
      "currency_code": "USD",
      "value": "10.00"
    }
  }]
}
```

### Order with Items

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "amount": {
      "currency_code": "USD",
      "value": "35.00",
      "breakdown": {
        "item_total": { "currency_code": "USD", "value": "30.00" },
        "shipping": { "currency_code": "USD", "value": "5.00" }
      }
    },
    "items": [
      {
        "name": "Product Name",
        "quantity": "2",
        "unit_amount": { "currency_code": "USD", "value": "15.00" },
        "sku": "PROD-001"
      }
    ]
  }]
}
```

### Order with Shipping

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "amount": {
      "currency_code": "USD",
      "value": "25.00"
    },
    "shipping": {
      "name": { "full_name": "John Doe" },
      "address": {
        "address_line_1": "123 Main St",
        "admin_area_2": "San Francisco",
        "admin_area_1": "CA",
        "postal_code": "94107",
        "country_code": "US"
      }
    }
  }],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "shipping_preference": "SET_PROVIDED_ADDRESS"
      }
    }
  }
}
```

## Client-Side Usage

```javascript
// client.js
async function createOrder() {
  try {
    const response = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: '10.00',
        currency: 'USD',
        description: 'Purchase from Your Store'
      })
    });

    if (!response.ok) {
      throw new Error(`Order creation failed: ${response.status}`);
    }

    const { id } = await response.json();
    return { orderId: id };

  } catch (error) {
    console.error('Order creation error:', error);
    throw error;
  }
}
```

## Security Requirements

- **ALWAYS validate amount server-side** - Never trust client-provided amounts
- **Use environment variables** for credentials
- **HTTPS only** for all API communication
- **Log PayPal debug IDs** for troubleshooting
- **Validate currency codes** against supported currencies
- **Use idempotency keys** (PayPal-Request-Id) to prevent duplicate orders
- **Sanitize user input** before creating orders

## Migration Notes

**v5 Pattern (Client-Side):**
```javascript
// v5: Order created in browser (client-side)
paypal.Buttons({
  createOrder: function(data, actions) {
    return actions.order.create({
      purchase_units: [{
        amount: { value: '10.00' }
      }]
    });
  }
});
```

**v6 Pattern (Server-Side):**
```javascript
// v6: Order created on server
async function createOrder() {
  const response = await fetch('/paypal-api/checkout/orders/create', {
    method: 'POST',
    body: JSON.stringify({ amount: '10.00' })
  });
  const { id } = await response.json();
  return { orderId: id };
}
```

## Common Issues

### Issue: "INVALID_REQUEST" error
**Cause**: Malformed order payload  
**Solution**: Validate payload structure matches PayPal API requirements

### Issue: Order amounts don't match
**Cause**: Breakdown totals don't sum correctly  
**Solution**: Ensure item_total + shipping + tax = total amount

### Issue: "PERMISSION_DENIED" error
**Cause**: App doesn't have required permissions  
**Solution**: Enable necessary features in PayPal Developer Dashboard

## Testing

```javascript
// Test order creation
async function testOrderCreation() {
  try {
    const order = await createOrder();
    console.log('Order created:', order.orderId);
  } catch (error) {
    console.error('Order creation failed:', error);
  }
}
```

## Best Practices

- Always validate and sanitize input data
- Format amounts to 2 decimal places
- Use idempotency keys for retry safety
- Log all PayPal debug IDs
- Implement proper error handling
- Never expose API credentials to client
- Validate order details match business rules
- Store order IDs for reference
- Implement order amount limits
- Use meaningful custom_id and invoice_id values

