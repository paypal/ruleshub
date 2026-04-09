# Using Saved Payment Methods with PayPal v6

**Official Documentation**: https://docs.paypal.ai/payments/methods/paypal/api/one-time/orders-api-integration

## Overview

This guide demonstrates how to use saved payment methods (payment tokens) with PayPal v6 SDK to process payments for returning customers.

## Client-Side Implementation

### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Use Saved Payment - PayPal v6</title>
    <script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&vault=true&intent=capture"></script>
</head>
<body>
    <div class="container">
        <h1>Complete Your Purchase</h1>
        
        <div class="order-summary">
            <h3>Order Summary</h3>
            <p>Total: $<span id="orderAmount">25.99</span></p>
        </div>

        <div class="payment-methods">
            <h3>Choose Payment Method</h3>
            
            <div id="loadingPaymentMethods" class="loading">
                Loading your saved payment methods...
            </div>
            
            <div id="savedPaymentMethods" style="display: none;">
                <!-- Saved payment methods will be populated here -->
            </div>
            
            <div id="errorMessage" class="error-message" style="display: none;"></div>
            <div id="successMessage" class="success-message" style="display: none;"></div>
            
            <button id="payWithSavedMethod" class="pay-button" disabled>
                Pay Now
            </button>
            
            <a href="#" class="add-payment-method" onclick="showAddPaymentMethod()">
                + Add New Payment Method
            </a>
        </div>

        <!-- Add new payment method section -->
        <div id="addPaymentMethodSection" style="display: none;">
            <h3>Add New Payment Method</h3>
            <div id="paypal-buttons-container"></div>
        </div>
    </div>

    <script>
        let selectedPaymentToken = null;
        let customerPaymentMethods = [];
        const customerId = 'customer_123'; // Replace with actual customer ID from your auth system

        // Initialize the page
        document.addEventListener('DOMContentLoaded', async function() {
            await loadSavedPaymentMethods();
            setupEventListeners();
        });

        // Load customer's saved payment methods
        async function loadSavedPaymentMethods() {
            try {
                const response = await fetch('/api/customer/payment-methods', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load payment methods: ${response.status}`);
                }

                const data = await response.json();
                customerPaymentMethods = data.payment_methods || [];
                
                document.getElementById('loadingPaymentMethods').style.display = 'none';
                document.getElementById('savedPaymentMethods').style.display = 'block';
                
                displayPaymentMethods(customerPaymentMethods);

            } catch (error) {
                console.error('Error loading payment methods:', error);
                showError('Failed to load saved payment methods. Please try again.');
                document.getElementById('loadingPaymentMethods').style.display = 'none';
            }
        }

        // Display saved payment methods
        function displayPaymentMethods(paymentMethods) {
            const container = document.getElementById('savedPaymentMethods');
            
            if (paymentMethods.length === 0) {
                container.innerHTML = `
                    <p>No saved payment methods found.</p>
                    <p>Add a payment method to save it for future purchases.</p>
                `;
                return;
            }

            const methodsHtml = paymentMethods.map(method => `
                <div class="saved-method" data-token-id="${method.id}" onclick="selectPaymentMethod('${method.id}')">
                    <div class="paypal-logo"></div>
                    <div class="method-info">
                        <div class="method-email">${method.email_address || 'PayPal Account'}</div>
                        <div class="method-date">Added ${formatDate(method.created_at)}</div>
                    </div>
                    <input type="radio" name="paymentMethod" value="${method.id}">
                </div>
            `).join('');

            container.innerHTML = methodsHtml;
        }

        // Select a payment method
        function selectPaymentMethod(tokenId) {
            // Remove selection from other methods
            document.querySelectorAll('.saved-method').forEach(method => {
                method.classList.remove('selected');
                method.querySelector('input[type="radio"]').checked = false;
            });

            // Select the clicked method
            const selectedMethod = document.querySelector(`[data-token-id="${tokenId}"]`);
            selectedMethod.classList.add('selected');
            selectedMethod.querySelector('input[type="radio"]').checked = true;

            selectedPaymentToken = tokenId;
            document.getElementById('payWithSavedMethod').disabled = false;
        }

        // Setup event listeners
        function setupEventListeners() {
            document.getElementById('payWithSavedMethod').addEventListener('click', processPaymentWithSavedMethod);
        }

        // Process payment with saved method
        async function processPaymentWithSavedMethod() {
            if (!selectedPaymentToken) {
                showError('Please select a payment method');
                return;
            }

            try {
                showLoading(true);
                
                // Create order with saved payment method
                const order = await createOrderWithSavedPayment(selectedPaymentToken);
                
                // Capture the order immediately (for intent=capture)
                const captureResult = await captureOrder(order.id);
                
                showSuccess(`Payment successful! Transaction ID: ${captureResult.id}`);
                
                // Redirect to success page or update UI
                setTimeout(() => {
                    window.location.href = `/order-confirmation?order=${order.id}`;
                }, 2000);

            } catch (error) {
                console.error('Payment failed:', error);
                showError(`Payment failed: ${error.message}`);
            } finally {
                showLoading(false);
            }
        }

        // Create order with saved payment method
        async function createOrderWithSavedPayment(paymentTokenId) {
            const orderData = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: document.getElementById('orderAmount').textContent
                    },
                    description: 'Purchase with saved payment method'
                }],
                payment_source: {
                    paypal: {
                        vault_id: paymentTokenId,
                        experience_context: {
                            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                            shipping_preference: "NO_SHIPPING",
                            user_action: "PAY_NOW"
                        }
                    }
                }
            };

            const response = await fetch('/api/orders/create-with-vault', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderData: orderData,
                    customerId: customerId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create order');
            }

            return await response.json();
        }

        // Capture order
        async function captureOrder(orderId) {
            const response = await fetch(`/api/orders/${orderId}/capture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to capture payment');
            }

            return await response.json();
        }

        // Show add payment method section
        function showAddPaymentMethod() {
            document.getElementById('addPaymentMethodSection').style.display = 'block';
            initializePayPalButtons();
        }

        // Initialize PayPal buttons for adding new payment method
        function initializePayPalButtons() {
            if (window.paypal) {
                window.paypal.Buttons({
                    createOrder: async function(data, actions) {
                        // Create setup token for vault
                        const response = await fetch('/api/vault/setup-token/create', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${getAuthToken()}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                customerId: customerId
                            })
                        });

                        const setupToken = await response.json();
                        return setupToken.id;
                    },
                    onApprove: async function(data, actions) {
                        // Create payment token from approved setup token
                        const response = await fetch('/api/vault/payment-token/create', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${getAuthToken()}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                setupToken: data.orderID,
                                customerId: customerId
                            })
                        });

                        if (response.ok) {
                            showSuccess('Payment method added successfully!');
                            // Reload payment methods
                            await loadSavedPaymentMethods();
                            document.getElementById('addPaymentMethodSection').style.display = 'none';
                        } else {
                            showError('Failed to save payment method');
                        }
                    },
                    onError: function(err) {
                        console.error('PayPal Buttons error:', err);
                        showError('Failed to add payment method');
                    }
                }).render('#paypal-buttons-container');
            }
        }

        // Utility functions
        function getAuthToken() {
            // Return your authentication token
            return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }

        function showError(message) {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Hide success message
            document.getElementById('successMessage').style.display = 'none';
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }

        function showSuccess(message) {
            const successDiv = document.getElementById('successMessage');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            
            // Hide error message
            document.getElementById('errorMessage').style.display = 'none';
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 5000);
        }

        function showLoading(show) {
            const button = document.getElementById('payWithSavedMethod');
            if (show) {
                button.disabled = true;
                button.textContent = 'Processing...';
            } else {
                button.disabled = false;
                button.textContent = 'Pay Now';
            }
        }
    </script>
</body>
</html>
```

## Server-Side Implementation

### Node.js/Express API Endpoints

#### Get Customer Payment Methods
```javascript
const express = require('express');
const router = express.Router();

// Get customer's saved payment methods
router.get('/customer/payment-methods', async (req, res) => {
  try {
    const customerId = req.user.id; // From authentication middleware
    
    // Get payment methods from database
    const paymentMethods = await getCustomerPaymentMethods(customerId);
    
    res.json({
      customer_id: customerId,
      payment_methods: paymentMethods
    });

  } catch (error) {
    console.error('Error retrieving payment methods:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve payment methods'
    });
  }
});

// Create order with vault payment method
router.post('/orders/create-with-vault', async (req, res) => {
  try {
    const { orderData, customerId } = req.body;
    
    // Validate customer
    if (customerId !== req.user.id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Unauthorized customer access'
      });
    }

    // Validate payment token belongs to customer
    const paymentToken = orderData.payment_source.paypal.vault_id;
    const isValidToken = await validatePaymentTokenOwnership(customerId, paymentToken);
    
    if (!isValidToken) {
      return res.status(400).json({
        error: 'INVALID_PAYMENT_TOKEN',
        message: 'Payment method not found or unauthorized'
      });
    }

    // Create order with PayPal
    const accessToken = await getPayPalAccessToken();
    const order = await createPayPalOrder(accessToken, orderData);
    
    // Log the transaction
    await logVaultTransaction(customerId, order.id, paymentToken, 'ORDER_CREATED');

    res.status(201).json(order);

  } catch (error) {
    console.error('Error creating order with vault:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create order',
      debugId: error.debugId || 'N/A'
    });
  }
});

// Capture order
router.post('/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id;
    
    // Validate order belongs to customer
    const orderOwnership = await validateOrderOwnership(orderId, customerId);
    if (!orderOwnership) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Order not found or unauthorized'
      });
    }

    // Capture the order
    const accessToken = await getPayPalAccessToken();
    const captureResult = await capturePayPalOrder(accessToken, orderId);
    
    // Update payment token last used timestamp
    if (captureResult.status === 'COMPLETED') {
      await updatePaymentTokenLastUsed(customerId, orderId);
      await logVaultTransaction(customerId, orderId, null, 'ORDER_CAPTURED');
    }

    res.json(captureResult);

  } catch (error) {
    console.error('Error capturing order:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to capture payment',
      debugId: error.debugId || 'N/A'
    });
  }
});

// Helper functions
async function getCustomerPaymentMethods(customerId) {
  try {
    const query = `
      SELECT id, email_address, created_at, last_used, status
      FROM customer_payment_tokens 
      WHERE customer_id = ? AND status = 'CREATED' AND is_deleted = FALSE
      ORDER BY created_at DESC
    `;
    
    const methods = await db.query(query, [customerId]);
    
    return methods.map(method => ({
      id: method.id,
      email_address: method.email_address,
      created_at: method.created_at,
      last_used: method.last_used,
      status: method.status
    }));

  } catch (error) {
    console.error('Database error getting payment methods:', error);
    throw new Error('Failed to retrieve payment methods');
  }
}

async function validatePaymentTokenOwnership(customerId, paymentTokenId) {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM customer_payment_tokens 
      WHERE customer_id = ? AND id = ? AND status = 'CREATED' AND is_deleted = FALSE
    `;
    
    const result = await db.query(query, [customerId, paymentTokenId]);
    return result[0].count > 0;

  } catch (error) {
    console.error('Error validating payment token ownership:', error);
    return false;
  }
}

async function createPayPalOrder(accessToken, orderData) {
  const orderUrl = `${getPayPalBaseUrl()}/v2/checkout/orders`;
  
  try {
    const response = await fetch(orderUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': generateIdempotencyKey(),
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('PayPal create order error:', response.status, errorData);
      throw new Error(`PayPal API Error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Create PayPal order failed:', error);
    throw error;
  }
}

async function capturePayPalOrder(accessToken, orderId) {
  const captureUrl = `${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`;
  
  try {
    const response = await fetch(captureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': generateIdempotencyKey(),
        'Prefer': 'return=representation'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('PayPal capture order error:', response.status, errorData);
      throw new Error(`PayPal API Error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Capture PayPal order failed:', error);
    throw error;
  }
}

async function updatePaymentTokenLastUsed(customerId, orderId) {
  try {
    const query = `
      UPDATE customer_payment_tokens 
      SET last_used = NOW() 
      WHERE customer_id = ? AND id IN (
        SELECT payment_token_id FROM vault_transactions 
        WHERE customer_id = ? AND order_id = ?
      )
    `;
    
    await db.query(query, [customerId, customerId, orderId]);

  } catch (error) {
    console.error('Error updating payment token last used:', error);
    // Non-critical error, don't throw
  }
}

async function logVaultTransaction(customerId, orderId, paymentTokenId, action) {
  try {
    const query = `
      INSERT INTO vault_transactions (customer_id, order_id, payment_token_id, action, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    
    await db.query(query, [customerId, orderId, paymentTokenId, action]);

  } catch (error) {
    console.error('Error logging vault transaction:', error);
    // Non-critical error, don't throw
  }
}

async function validateOrderOwnership(orderId, customerId) {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM vault_transactions 
      WHERE order_id = ? AND customer_id = ?
    `;
    
    const result = await db.query(query, [orderId, customerId]);
    return result[0].count > 0;

  } catch (error) {
    console.error('Error validating order ownership:', error);
    return false;
  }
}

module.exports = router;
```

## Database Schema

### Additional Tables for Vault Transactions
```sql
CREATE TABLE vault_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    payment_token_id VARCHAR(255),
    action VARCHAR(50) NOT NULL, -- 'ORDER_CREATED', 'ORDER_CAPTURED', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_order_id (order_id),
    INDEX idx_created_at (created_at)
);
```

## Security Considerations

- **Validate payment token ownership** before processing payments
- **Implement order ownership validation** to prevent unauthorized access
- **Log all vault transactions** for audit trails
- **Use secure authentication** for API endpoints
- **Validate customer identity** consistently across requests
- **Implement rate limiting** on payment endpoints
- **Encrypt sensitive data** in database
- **Use HTTPS only** for all communications

## Error Handling

- Handle expired or invalid payment tokens gracefully
- Provide clear error messages for failed payments
- Implement retry logic for network failures
- Log all errors with sufficient context for debugging
- Display user-friendly error messages on the frontend

## Testing Checklist

- [ ] Load saved payment methods successfully
- [ ] Select and use saved payment method for payment
- [ ] Handle case with no saved payment methods
- [ ] Validate payment token ownership
- [ ] Process successful payments
- [ ] Handle payment failures gracefully
- [ ] Test with multiple saved payment methods
- [ ] Verify database logging and updates
- [ ] Test error scenarios (expired tokens, network failures)
- [ ] Validate order ownership and security