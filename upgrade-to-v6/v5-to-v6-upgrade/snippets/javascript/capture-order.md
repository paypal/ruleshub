# Capture Order (Server-Side)

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
 * Capture PayPal order
 * POST /paypal-api/checkout/orders/:orderId/capture
 */
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate order ID
    if (!orderId) {
      return res.status(400).json({
        error: 'INVALID_ORDER_ID',
        message: 'Order ID is required'
      });
    }

    console.log('Capturing order:', orderId);

    // IMPORTANT: Validate order details before capture
    // This ensures order hasn't been tampered with
    const accessToken = await getPayPalAccessToken();
    
    // Step 1: Get order details to validate
    const orderDetails = await axios.get(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // Validate order status
    if (orderDetails.data.status !== 'APPROVED') {
      return res.status(400).json({
        error: 'ORDER_NOT_APPROVED',
        message: `Order status is ${orderDetails.data.status}, not APPROVED`,
        orderId
      });
    }

    // CRITICAL: Validate order amount matches expected amount
    // This prevents amount manipulation attacks
    const orderAmount = orderDetails.data.purchase_units[0].amount.value;
    console.log('Order amount:', orderAmount);

    // Step 2: Capture the order
    // v5 equivalent: actions.order.capture()
    const captureResponse = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {}, // Empty body
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(), // Idempotency key
        },
      }
    );

    const captureData = captureResponse.data;
    
    console.log('Order captured successfully:', {
      orderId: captureData.id,
      status: captureData.status,
      captureId: captureData.purchase_units[0]?.payments?.captures?.[0]?.id
    });

    // Extract capture details
    const capture = captureData.purchase_units[0]?.payments?.captures?.[0];

    // Return capture details to client
    res.json({
      id: captureData.id,
      status: captureData.status,
      captureId: capture?.id,
      amount: capture?.amount,
      payer: captureData.payer,
      create_time: capture?.create_time
    });

  } catch (error) {
    console.error('Error capturing order:', {
      message: error.message,
      response: error.response?.data,
      debugId: error.response?.headers?.['paypal-debug-id']
    });

    // Handle specific error cases
    const errorData = error.response?.data;
    const debugId = error.response?.headers?.['paypal-debug-id'];

    if (error.response?.status === 422) {
      // Order already captured or invalid state
      return res.status(422).json({
        error: 'ORDER_ALREADY_CAPTURED',
        message: errorData?.message || 'Order cannot be captured',
        debugId,
        details: errorData?.details
      });
    }

    res.status(error.response?.status || 500).json({
      error: 'CAPTURE_FAILED',
      message: errorData?.message || 'Failed to capture order',
      debugId,
      details: errorData?.details
    });
  }
});
```

### Node.js with Fetch (Native)

```javascript
// capture.js

/**
 * Capture PayPal order using native fetch
 */
export async function capturePayPalOrder(orderId) {
  try {
    // Validate order ID
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Invalid order ID');
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();

    // Get order details first (for validation)
    const orderResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!orderResponse.ok) {
      throw new Error('Failed to get order details');
    }

    const orderData = await orderResponse.json();

    // Validate order is approved
    if (orderData.status !== 'APPROVED') {
      throw new Error(`Order not approved. Status: ${orderData.status}`);
    }

    // Capture the order
    const captureResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID()
        },
        body: JSON.stringify({})
      }
    );

    if (!captureResponse.ok) {
      const error = await captureResponse.json();
      throw new Error(`Capture failed: ${error.message}`);
    }

    const captureData = await captureResponse.json();
    return captureData;

  } catch (error) {
    console.error('Capture order error:', error);
    throw error;
  }
}
```

## Client-Side Usage

```javascript
// client.js

/**
 * Capture order after approval
 * Called from onApprove callback
 */
async function captureOrder({ orderId }) {
  try {
    const response = await fetch(
      `/paypal-api/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Capture failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Payment captured:', data);
    
    return data;

  } catch (error) {
    console.error('Capture error:', error);
    throw error;
  }
}

// Usage in payment session
const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
  onApprove: async (data) => {
    try {
      await captureOrder({ orderId: data.orderId });
      // Redirect to success page
      window.location.href = '/success?orderId=' + data.orderId;
    } catch (error) {
      console.error('Payment capture failed:', error);
      showError('Payment processing failed. Please contact support.');
    }
  }
});
```

## Response Example

```json
{
  "id": "5O190127TN364715T",
  "status": "COMPLETED",
  "captureId": "3C679366HH908993F",
  "amount": {
    "currency_code": "USD",
    "value": "10.00"
  },
  "payer": {
    "email_address": "buyer@example.com",
    "payer_id": "BUYER123",
    "name": {
      "given_name": "John",
      "surname": "Doe"
    }
  },
  "create_time": "2025-01-15T10:30:00Z"
}
```

## Security Checklist

- **Validate order ID format** before processing
- **Get and validate order status** before capture
- **ALWAYS validate order amount** matches expected amount
- **Check order hasn't been captured already**
- **Use idempotency keys** (PayPal-Request-Id)
- **Log PayPal debug IDs** for troubleshooting
- **Store capture details** in database
- **Never trust client-provided amounts**
- **Validate order ownership** if using user accounts

## Error Handling

### Common Errors

| Error Code | Status | Cause | Solution |
|------------|--------|-------|----------|
| `ORDER_NOT_FOUND` | 404 | Invalid order ID | Verify order was created |
| `ORDER_NOT_APPROVED` | 400 | Order not approved by buyer | Check order status |
| `ORDER_ALREADY_CAPTURED` | 422 | Order already captured | Check capture status |
| `AMOUNT_MISMATCH` | 400 | Amount manipulation | Validate amounts server-side |
| `INSUFFICIENT_FUNDS` | 422 | Buyer has insufficient funds | Notify buyer |

### Error Response Example

```json
{
  "error": "ORDER_ALREADY_CAPTURED",
  "message": "Order has already been captured",
  "debugId": "abc123def456",
  "details": [
    {
      "issue": "ORDER_ALREADY_CAPTURED",
      "description": "Order has already been captured and cannot be captured again."
    }
  ]
}
```

## Migration Notes

**v5 Pattern (Client-Side):**
```javascript
// v5: Capture in browser (client-side)
paypal.Buttons({
  onApprove: function(data, actions) {
    return actions.order.capture().then(function(details) {
      console.log('Captured:', details);
    });
  }
});
```

**v6 Pattern (Server-Side):**
```javascript
// v6: Capture on server
const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
  onApprove: async (data) => {
    // Call server to capture
    await captureOrder({ orderId: data.orderId });
  }
});
```

## Best Practices

**Always validate order details before capture**  
**Implement idempotency with PayPal-Request-Id**  
**Log all captures for audit trail**  
**Store capture details in database**  
**Validate amounts match expected values**  
**Handle duplicate capture attempts gracefully**  
**Extract and log PayPal debug IDs**  
**Return appropriate HTTP status codes**  
**Implement proper error messages**  
**Never expose internal error details to client**  

## Testing

```javascript
// Test capture flow
async function testCapture() {
  try {
    // Create order first
    const { orderId } = await createOrder();
    console.log('Order created:', orderId);

    // Capture order
    const capture = await captureOrder({ orderId });
    console.log('Order captured:', capture.captureId);

  } catch (error) {
    console.error('Capture test failed:', error);
  }
}
```

## Common Issues

### Issue: "ORDER_NOT_APPROVED" error
**Cause**: Trying to capture order before buyer approval  
**Solution**: Only capture after onApprove callback is triggered

### Issue: "ORDER_ALREADY_CAPTURED" error
**Cause**: Attempting to capture order twice  
**Solution**: Check order status before capture, implement idempotency

### Issue: Amount mismatch
**Cause**: Order amount doesn't match expected amount  
**Solution**: Always validate amounts server-side before capture

### Issue: Capture succeeds but database update fails
**Cause**: Network/database error after PayPal capture  
**Solution**: Implement transaction rollback or manual reconciliation process

