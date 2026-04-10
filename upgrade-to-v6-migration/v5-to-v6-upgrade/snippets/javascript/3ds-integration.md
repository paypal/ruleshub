# 3D Secure (3DS) Integration - v6 SDK

## Overview
3D Secure (3DS) provides Strong Customer Authentication (SCA) for card payments. In v6 SDK, 3DS is configured server-side and handled automatically by the SDK.

## Key Points

- **Configuration**: Server-side only
- **Client handling**: Automatic (SDK handles redirect/iframe)
- **No client code changes**: Same card fields flow
- **Result location**: `data.liabilityShift` in submit response

## Server-Side: Order Creation with 3DS

```javascript
const express = require('express');
const fetch = require('node-fetch');

app.post('/paypal-api/checkout/orders/create', express.json(), async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const accessToken = await getAccessToken();
    
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency || 'USD',
            value: amount
          }
        }],
        payment_source: {
          card: {
            attributes: {
              verification: {
                method: 'SCA_WHEN_REQUIRED' // or 'SCA_ALWAYS'
              }
            },
            // Note: experience_context is required for 3DS
            experience_context: {
              return_url: 'https://example.com/returnUrl',
              cancel_url: 'https://example.com/cancelUrl'
            }
          }
        }
      })
    });
    
    const orderData = await orderResponse.json();
    res.json(orderData);
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});
```

## Verification Methods

### SCA_WHEN_REQUIRED
```javascript
verification: {
  method: 'SCA_WHEN_REQUIRED'
}
```
- Performs 3DS only when required by card issuer or regulation
- Provides balanced security and user experience
- Suitable for EU/UK/India compliance

### SCA_ALWAYS
```javascript
verification: {
  method: 'SCA_ALWAYS'
}
```
- Performs 3DS authentication for every transaction
- Provides higher level of security
- May impact conversion rates

## Client-Side: Handling 3DS (Automatic)

```javascript
async function onPayButtonClick() {
  try {
    // Create order (with 3DS configured server-side)
    const orderResponse = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '100.00',
        currency: 'USD'
      })
    });
    
    const orderData = await orderResponse.json();
    
    // Submit - 3DS happens automatically if needed
    const { state, data } = await cardSession.submit(orderData.id, {
      billingAddress: { postalCode: '95131' }
    });
    
    switch (state) {
      case 'succeeded':
        // Check liabilityShift from submit response
        // 3DS may or may not have occurred
        console.log('Liability Shift:', data.liabilityShift); 
        // Values: POSSIBLE, NO, UNKNOWN, null
        
        if (data.liabilityShift === 'POSSIBLE') {
          console.log('Liability shifted to card issuer');
        } else if (data.liabilityShift === 'NO') {
          console.log('Liability remains with merchant');
        }
        
        // Capture payment
        const captureResponse = await fetch(
          `/paypal-api/checkout/orders/${data.orderId}/capture`,
          { method: 'POST' }
        );
        
        const captureData = await captureResponse.json();
        
        // Check authentication result in capture response
        const authResult = captureData?.payment_source?.card?.authentication_result;
        if (authResult) {
          console.log('3DS Authentication Result:', {
            liabilityShift: authResult.liability_shift,
            authenticationStatus: authResult.three_d_secure?.authentication_status,
            enrollmentStatus: authResult.three_d_secure?.enrollment_status
          });
        }
        
        console.log('Payment successful');
        break;
        
      case 'failed':
        console.error('Payment failed:', data);
        break;
        
      case 'canceled':
        console.log('Payment canceled by user');
        break;
    }
    
  } catch (error) {
    console.error('Payment error:', error);
  }
}
```

## Liability Shift Values

**POSSIBLE** - Liability shifted to card issuer
**NO** - Liability remains with merchant
**UNKNOWN** - Liability status cannot be determined
**null** - 3DS authentication was not performed

## Authentication Status Codes

From `capture_response.payment_source.card.authentication_result.three_d_secure`:

**authentication_status:**
- `Y` - Authentication completed
- `N` - Authentication not completed
- `A` - Attempted authentication
- `U` - Unable to perform authentication
- `R` - Authentication rejected
- `C` - Challenge required

**enrollment_status:**
- `Y` - Card enrolled in 3DS
- `N` - Card not enrolled
- `U` - Unable to verify enrollment
- `B` - Bypass authentication

## 3DS with Card Vaulting

```javascript
// Server-side: Order creation with both 3DS and vaulting
app.post('/paypal-api/checkout/orders/create', express.json(), async (req, res) => {
  try {
    const { amount, currency, saveCard } = req.body;
    const accessToken = await getAccessToken();
    
    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency || 'USD',
          value: amount
        }
      }],
      payment_source: {
        card: {
          attributes: {
            // 3DS configuration
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            }
          },
          // Required for 3DS
          experience_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
          }
        }
      }
    };
    
    // Add vaulting if requested
    if (saveCard) {
      orderBody.payment_source.card.attributes.vault = {
        store_in_vault: 'ON_SUCCESS',
        usage_type: 'MERCHANT',
        customer_type: 'CONSUMER',
        permit_multiple_payment_tokens: true
      };
    }
    
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderBody)
    });
    
    const orderData = await orderResponse.json();
    res.json(orderData);
    
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});
```

## Regional Requirements

### Mandatory Regions
- **European Union**: Required (PSD2/SCA)
- **United Kingdom**: Required (UK FCA)
- **India**: Mandatory (RBI guidelines)

### Optional
- **United States**: High-value transactions
- **Brazil**: Fraud prevention
- **Australia**: Various use cases

## Complete Example with 3DS

```javascript
// Client-side
let cardSession;

async function onPayPalWebSdkLoaded() {
  try {
    const tokenResponse = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken } = await tokenResponse.json();
    
    const sdk = await window.paypal.createInstance({
      clientToken: accessToken,
      components: ['card-fields']
    });
    
    const methods = await sdk.findEligibleMethods();
    if (!methods.isEligible('advanced_cards')) return;
    
    cardSession = sdk.createCardFieldsOneTimePaymentSession();
    
    // Create and mount components
    const numberField = cardSession.createCardFieldsComponent({ type: 'number' });
    const expiryField = cardSession.createCardFieldsComponent({ type: 'expiry' });
    const cvvField = cardSession.createCardFieldsComponent({ type: 'cvv' });
    
    document.querySelector('#paypal-card-fields-number').appendChild(numberField);
    document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
    document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
    
    document.getElementById('pay-button').addEventListener('click', async () => {
      try {
        // Create order with 3DS enabled
        const orderRes = await fetch('/paypal-api/checkout/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '100.00', currency: 'USD' })
        });
        
        const order = await orderRes.json();
        
        // Submit - 3DS happens here if needed
        const { state, data } = await cardSession.submit(order.id, {
          billingAddress: { postalCode: '95131' }
        });
        
        switch (state) {
          case 'succeeded':
            console.log('3DS Status:', data.liabilityShift);
            
            const captureRes = await fetch(
              `/paypal-api/checkout/orders/${data.orderId}/capture`,
              { method: 'POST' }
            );
            const capture = await captureRes.json();
            
            console.log('Payment complete:', capture);
            alert('Payment successful');
            break;
            
          case 'failed':
            alert('Payment failed');
            break;
            
          case 'canceled':
            alert('3DS authentication canceled');
            break;
        }
      } catch (error) {
        console.error('Error:', error);
      }
    });
    
  } catch (error) {
    console.error('SDK init error:', error);
  }
}
```

## Implementation Guidelines

1. Include return_url and cancel_url - Required for 3DS functionality
2. Use SCA_WHEN_REQUIRED - Provides balanced security and user experience
3. Check liabilityShift value before capturing payments
4. Handle the canceled state when users exit the 3DS authentication flow
5. Log authentication attempts for compliance requirements
6. Store 3DS results in database for audit purposes
7. Test success, failure, and cancellation flows

## Troubleshooting

**3DS modal not appearing** - Missing return_url or cancel_url - Add experience_context configuration
**liabilityShift is null** - 3DS not configured - Add verification.method to order request
**Authentication failures** - Verify test card details and 3DS configuration

## Important Notes

- return_url and cancel_url are required for 3DS functionality
- 3DS authentication is handled automatically by the SDK
- Client code remains the same as standard card fields flow
- Review liabilityShift value to assess transaction risk
- SCA_WHEN_REQUIRED is a commonly used verification method
- Use appropriate test cards for 3DS testing

