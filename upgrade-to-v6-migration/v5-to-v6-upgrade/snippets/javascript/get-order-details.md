# Get Order Details (Server-Side)

**Official Documentation**: https://docs.paypal.com/api/orders/v2/#orders_get

## Overview

This guide demonstrates how to retrieve order details from PayPal using the Orders v2 API. This is useful for order verification, refunds, displaying order history, and reconciliation.

## Use Cases

- **Order Verification**: Validate order status before fulfillment
- **Order History**: Display past orders to customers
- **Refund Processing**: Get order details before issuing refunds
- **Reconciliation**: Match PayPal orders with internal records
- **Dispute Resolution**: Retrieve transaction details for customer support
- **Reporting**: Generate transaction reports and analytics

## API Endpoint

```
GET /v2/checkout/orders/{order_id}
```

## Node.js/Express Implementation

### Basic Order Retrieval

```javascript
const express = require('express');
const router = express.Router();

/**
 * Get PayPal order details
 * GET /paypal-api/orders/:orderId
 */
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate order ID format
    if (!orderId || !isValidOrderId(orderId)) {
      return res.status(400).json({
        error: 'INVALID_ORDER_ID',
        message: 'Invalid or missing order ID'
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Fetch order details from PayPal
    const orderDetails = await getOrderDetails(accessToken, orderId);

    // Return order details
    res.json(orderDetails);

  } catch (error) {
    console.error('Error getting order details:', error);

    const debugId = error.response?.headers?.['paypal-debug-id'] || 'N/A';
    console.log('PayPal Debug ID:', debugId);

    res.status(error.response?.status || 500).json({
      error: 'ORDER_RETRIEVAL_FAILED',
      message: error.response?.data?.message || 'Failed to retrieve order details',
      debugId: debugId
    });
  }
});

/**
 * Get order details from PayPal API
 */
async function getOrderDetails(accessToken, orderId) {
  const orderUrl = `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}`;

  try {
    const response = await fetch(orderUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
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

    const orderDetails = await response.json();
    console.log('Order retrieved successfully:', orderDetails.id);

    return orderDetails;

  } catch (error) {
    console.error('Get order details failed:', error);
    throw error;
  }
}

/**
 * Validate order ID format
 */
function isValidOrderId(orderId) {
  // PayPal order IDs are typically 17 characters alphanumeric
  const orderIdPattern = /^[A-Z0-9]{17}$/i;
  return orderIdPattern.test(orderId);
}

/**
 * Get PayPal access token
 */
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

function getPayPalBaseUrl() {
  const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
  return environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

module.exports = router;
```

### Advanced Order Retrieval with Filtering

```javascript
/**
 * Get order details with optional filtering
 * GET /paypal-api/orders/:orderId?fields=minimal
 */
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { fields } = req.query; // 'minimal' or 'full' (default)

    if (!orderId || !isValidOrderId(orderId)) {
      return res.status(400).json({
        error: 'INVALID_ORDER_ID',
        message: 'Invalid or missing order ID'
      });
    }

    // Validate customer authorization
    const customerId = req.user?.id; // From auth middleware
    if (!customerId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Check if order belongs to customer
    const orderOwnership = await validateOrderOwnership(orderId, customerId);
    if (!orderOwnership) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Order not found or access denied'
      });
    }

    const accessToken = await getPayPalAccessToken();
    const orderDetails = await getOrderDetails(accessToken, orderId);

    // Filter response based on requested fields
    const filteredDetails = fields === 'minimal'
      ? getMinimalOrderDetails(orderDetails)
      : orderDetails;

    res.json(filteredDetails);

  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      error: 'ORDER_RETRIEVAL_FAILED',
      message: 'Failed to retrieve order details'
    });
  }
});

/**
 * Extract minimal order details
 */
function getMinimalOrderDetails(orderDetails) {
  return {
    id: orderDetails.id,
    status: orderDetails.status,
    create_time: orderDetails.create_time,
    update_time: orderDetails.update_time,
    amount: {
      currency_code: orderDetails.purchase_units?.[0]?.amount?.currency_code,
      value: orderDetails.purchase_units?.[0]?.amount?.value
    },
    payer: {
      email_address: orderDetails.payer?.email_address,
      name: orderDetails.payer?.name
    }
  };
}

/**
 * Validate order ownership
 */
async function validateOrderOwnership(orderId, customerId) {
  try {
    // Query your database to verify order belongs to customer
    const query = `
      SELECT COUNT(*) as count
      FROM orders
      WHERE paypal_order_id = ? AND customer_id = ?
    `;

    const result = await db.query(query, [orderId, customerId]);
    return result[0].count > 0;

  } catch (error) {
    console.error('Error validating order ownership:', error);
    return false;
  }
}
```

## Python/Flask Implementation

```python
from flask import Blueprint, request, jsonify
import requests
import os
import re

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/orders/<order_id>', methods=['GET'])
def get_order_details(order_id):
    try:
        # Validate order ID
        if not is_valid_order_id(order_id):
            return jsonify({
                'error': 'INVALID_ORDER_ID',
                'message': 'Invalid order ID format'
            }), 400

        # Get access token
        access_token = get_paypal_access_token()

        # Fetch order details
        order_details = fetch_order_details(access_token, order_id)

        return jsonify(order_details)

    except Exception as error:
        print(f'Error getting order details: {error}')

        return jsonify({
            'error': 'ORDER_RETRIEVAL_FAILED',
            'message': 'Failed to retrieve order details'
        }), 500

def fetch_order_details(access_token, order_id):
    order_url = f"{get_paypal_base_url()}/v2/checkout/orders/{order_id}"

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {access_token}'
    }

    try:
        response = requests.get(order_url, headers=headers)

        if not response.ok:
            error_data = response.text
            print(f'PayPal API error: {response.status_code} {error_data}')
            raise Exception(f'PayPal API Error: {response.status_code}')

        order_details = response.json()
        print(f'Order retrieved: {order_details["id"]}')

        return order_details

    except Exception as error:
        print(f'Fetch order details failed: {error}')
        raise error

def is_valid_order_id(order_id):
    # Validate order ID format (17 alphanumeric characters)
    pattern = r'^[A-Z0-9]{17}$'
    return bool(re.match(pattern, order_id, re.IGNORECASE))

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

def get_paypal_base_url():
    environment = os.getenv('PAYPAL_ENVIRONMENT', 'sandbox')
    return 'https://api-m.paypal.com' if environment == 'live' else 'https://api-m.sandbox.paypal.com'
```

## Order Response Structure

### Complete Order Response

```json
{
  "id": "5O190127TN364715T",
  "status": "COMPLETED",
  "intent": "CAPTURE",
  "payment_source": {
    "paypal": {
      "email_address": "buyer@example.com",
      "account_id": "QYR5Z8XDVJNXQ",
      "account_status": "VERIFIED",
      "name": {
        "given_name": "John",
        "surname": "Doe"
      },
      "address": {
        "country_code": "US"
      }
    }
  },
  "purchase_units": [
    {
      "reference_id": "default",
      "amount": {
        "currency_code": "USD",
        "value": "25.99"
      },
      "payee": {
        "email_address": "merchant@example.com",
        "merchant_id": "MERCHANT123"
      },
      "description": "Purchase from Your Store",
      "payments": {
        "captures": [
          {
            "id": "3C679366HH908993F",
            "status": "COMPLETED",
            "amount": {
              "currency_code": "USD",
              "value": "25.99"
            },
            "final_capture": true,
            "seller_protection": {
              "status": "ELIGIBLE",
              "dispute_categories": [
                "ITEM_NOT_RECEIVED",
                "UNAUTHORIZED_TRANSACTION"
              ]
            },
            "create_time": "2025-01-15T10:30:45Z",
            "update_time": "2025-01-15T10:30:45Z"
          }
        ]
      }
    }
  ],
  "payer": {
    "name": {
      "given_name": "John",
      "surname": "Doe"
    },
    "email_address": "buyer@example.com",
    "payer_id": "QYR5Z8XDVJNXQ",
    "address": {
      "country_code": "US"
    }
  },
  "create_time": "2025-01-15T10:30:00Z",
  "update_time": "2025-01-15T10:30:45Z",
  "links": [
    {
      "href": "https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T",
      "rel": "self",
      "method": "GET"
    }
  ]
}
```

### Order Status Values

| Status | Description |
|--------|-------------|
| `CREATED` | Order created but not yet approved |
| `SAVED` | Order saved (subscription or billing agreement) |
| `APPROVED` | Buyer approved but not yet captured |
| `VOIDED` | Order voided (cannot be captured) |
| `COMPLETED` | Order completed (payment captured) |
| `PAYER_ACTION_REQUIRED` | Payer action required to complete |

## Client-Side Usage

### Fetch Order Details

```javascript
/**
 * Get order details from server
 */
async function getOrderDetails(orderId) {
  try {
    const response = await fetch(`/paypal-api/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get order details');
    }

    const orderDetails = await response.json();
    return orderDetails;

  } catch (error) {
    console.error('Error getting order details:', error);
    throw error;
  }
}
```

### Display Order Details

```javascript
/**
 * Display order information to user
 */
async function displayOrderDetails(orderId) {
  try {
    const order = await getOrderDetails(orderId);

    const amount = order.purchase_units[0].amount;
    const payer = order.payer;
    const status = order.status;

    document.getElementById('order-id').textContent = order.id;
    document.getElementById('order-status').textContent = status;
    document.getElementById('order-amount').textContent = `${amount.value} ${amount.currency_code}`;
    document.getElementById('payer-name').textContent = `${payer.name.given_name} ${payer.name.surname}`;
    document.getElementById('payer-email').textContent = payer.email_address;
    document.getElementById('order-date').textContent = new Date(order.create_time).toLocaleDateString();

  } catch (error) {
    console.error('Failed to display order details:', error);
    showErrorMessage('Failed to load order details');
  }
}
```

### Order History List

```javascript
/**
 * Display list of customer orders
 */
async function displayOrderHistory(customerId) {
  try {
    // Get order IDs from your database
    const orderIds = await getCustomerOrderIds(customerId);

    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = '';

    for (const orderId of orderIds) {
      const order = await getOrderDetails(orderId);

      const orderElement = document.createElement('div');
      orderElement.className = 'order-item';
      orderElement.innerHTML = `
        <div class="order-summary">
          <h3>Order #${order.id}</h3>
          <p>Status: <span class="status-${order.status.toLowerCase()}">${order.status}</span></p>
          <p>Amount: ${order.purchase_units[0].amount.value} ${order.purchase_units[0].amount.currency_code}</p>
          <p>Date: ${new Date(order.create_time).toLocaleDateString()}</p>
        </div>
      `;

      ordersList.appendChild(orderElement);
    }

  } catch (error) {
    console.error('Failed to display order history:', error);
    showErrorMessage('Failed to load order history');
  }
}

async function getCustomerOrderIds(customerId) {
  const response = await fetch(`/api/customers/${customerId}/orders`);
  const data = await response.json();
  return data.orderIds;
}
```

## TypeScript Implementation

```typescript
import type {
  PayPalOrder,
  OrderStatus,
  PaymentSource,
  PurchaseUnit,
  Capture
} from './paypal-types';

interface OrderDetailsResponse {
  id: string;
  status: OrderStatus;
  payment_source: PaymentSource;
  purchase_units: PurchaseUnit[];
  payer: {
    name: { given_name: string; surname: string };
    email_address: string;
    payer_id: string;
  };
  create_time: string;
  update_time: string;
}

async function getOrderDetails(orderId: string): Promise<OrderDetailsResponse> {
  const response = await fetch(`/paypal-api/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get order details');
  }

  return await response.json();
}

function isOrderCompleted(order: OrderDetailsResponse): boolean {
  return order.status === 'COMPLETED';
}

function getOrderAmount(order: OrderDetailsResponse): { value: string; currency: string } {
  const amount = order.purchase_units[0].amount;
  return {
    value: amount.value,
    currency: amount.currency_code
  };
}

function getCaptureDetails(order: OrderDetailsResponse): Capture | null {
  return order.purchase_units[0]?.payments?.captures?.[0] || null;
}
```

## Use Case Examples

### Verify Order Before Fulfillment

```javascript
/**
 * Verify order is completed before shipping
 */
async function verifyOrderBeforeFulfillment(orderId) {
  try {
    const accessToken = await getPayPalAccessToken();
    const order = await getOrderDetails(accessToken, orderId);

    // Check order status
    if (order.status !== 'COMPLETED') {
      throw new Error(`Order not completed. Status: ${order.status}`);
    }

    // Check capture status
    const capture = order.purchase_units[0]?.payments?.captures?.[0];
    if (!capture || capture.status !== 'COMPLETED') {
      throw new Error('Payment not captured');
    }

    // Check seller protection
    const protection = capture.seller_protection;
    if (protection.status !== 'ELIGIBLE') {
      console.warn('Order not eligible for seller protection');
    }

    console.log('Order verified for fulfillment:', orderId);
    return true;

  } catch (error) {
    console.error('Order verification failed:', error);
    return false;
  }
}
```

### Refund Eligibility Check

```javascript
/**
 * Check if order is eligible for refund
 */
async function checkRefundEligibility(orderId) {
  try {
    const accessToken = await getPayPalAccessToken();
    const order = await getOrderDetails(accessToken, orderId);

    if (order.status !== 'COMPLETED') {
      return {
        eligible: false,
        reason: 'Order not completed'
      };
    }

    const capture = order.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      return {
        eligible: false,
        reason: 'No capture found'
      };
    }

    // Check capture date (PayPal allows refunds within 180 days)
    const captureDate = new Date(capture.create_time);
    const daysSinceCapture = (Date.now() - captureDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCapture > 180) {
      return {
        eligible: false,
        reason: 'Capture older than 180 days'
      };
    }

    return {
      eligible: true,
      captureId: capture.id,
      amount: capture.amount
    };

  } catch (error) {
    console.error('Refund eligibility check failed:', error);
    return {
      eligible: false,
      reason: 'Error checking eligibility'
    };
  }
}
```

## Database Storage

### Store Order Details

```javascript
/**
 * Store order details in database
 */
async function storeOrderDetails(orderDetails) {
  try {
    const capture = orderDetails.purchase_units[0]?.payments?.captures?.[0];

    const orderData = {
      paypal_order_id: orderDetails.id,
      status: orderDetails.status,
      amount: orderDetails.purchase_units[0].amount.value,
      currency: orderDetails.purchase_units[0].amount.currency_code,
      payer_email: orderDetails.payer.email_address,
      payer_name: `${orderDetails.payer.name.given_name} ${orderDetails.payer.name.surname}`,
      capture_id: capture?.id,
      capture_status: capture?.status,
      created_at: new Date(orderDetails.create_time),
      updated_at: new Date(orderDetails.update_time)
    };

    await db.query(`
      INSERT INTO orders (
        paypal_order_id, status, amount, currency, payer_email, payer_name,
        capture_id, capture_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderData.paypal_order_id,
      orderData.status,
      orderData.amount,
      orderData.currency,
      orderData.payer_email,
      orderData.payer_name,
      orderData.capture_id,
      orderData.capture_status,
      orderData.created_at,
      orderData.updated_at
    ]);

    console.log('Order stored in database:', orderDetails.id);

  } catch (error) {
    console.error('Failed to store order details:', error);
    throw error;
  }
}
```

## Security Considerations

- **Validate order ownership** before returning details
- **Implement authentication** for all order endpoints
- **Use HTTPS only** for API communications
- **Log access attempts** for audit purposes
- **Sanitize order IDs** before database queries
- **Limit rate of requests** to prevent abuse
- **Don't expose sensitive data** to unauthorized users
- **Validate PayPal response** authenticity

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `RESOURCE_NOT_FOUND` | Order ID not found | Verify order ID is correct |
| `PERMISSION_DENIED` | Insufficient permissions | Check API credentials |
| `AUTHENTICATION_FAILURE` | Invalid access token | Regenerate access token |
| `INVALID_REQUEST` | Malformed request | Validate request format |

### Error Response Example

```json
{
  "name": "RESOURCE_NOT_FOUND",
  "message": "The specified resource does not exist.",
  "debug_id": "7c123456789abcdef",
  "details": [
    {
      "issue": "INVALID_RESOURCE_ID",
      "description": "Specified resource ID does not exist."
    }
  ]
}
```

## Testing

```javascript
// Test order retrieval
async function testGetOrderDetails() {
  const testOrderId = '5O190127TN364715T'; // Use real sandbox order ID

  try {
    const order = await getOrderDetails(testOrderId);
    console.log('Order retrieved successfully');
    console.log('  Order ID:', order.id);
    console.log('  Status:', order.status);
    console.log('  Amount:', order.purchase_units[0].amount.value);
  } catch (error) {
    console.error('Order retrieval failed:', error);
  }
}
```

## Best Practices

- **Cache order details** appropriately to reduce API calls
- **Implement pagination** for order history lists
- **Use webhooks** for real-time order status updates
- **Validate order status** before business operations
- **Log all order retrievals** for audit trails
- **Handle API rate limits** gracefully
- **Store essential order data** in your database
- **Implement retry logic** for transient failures

## References

- [Create Order](./create-order.md)
- [Capture Order](./capture-order.md)
- [Error Handling](./error-handling.md)
- [TypeScript Types](./TYPESCRIPT_TYPES.md)
