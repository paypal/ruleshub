# Card Vaulting Integration - v6 SDK

## Overview
Save customer cards for future payments using v6 SDK card vaulting (save with purchase).

## HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PayPal Card Vaulting - v6 SDK</title>
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
</head>
<body>
  <h1>Checkout</h1>
  
  <!-- Card field containers -->
  <div id="paypal-card-fields-number"></div>
  <div id="paypal-card-fields-expiry"></div>
  <div id="paypal-card-fields-cvv"></div>
  
  <!-- Save card checkbox -->
  <div>
    <input type="checkbox" id="save-card-checkbox" name="save-card">
    <label for="save-card-checkbox">Save card for future purchases</label>
  </div>
  
  <button id="pay-button" type="button">Pay $100.00</button>
  <div id="result-message"></div>
</body>
</html>
```

## Client-Side JavaScript

```javascript
let cardSession;

async function onPayPalWebSdkLoaded() {
  try {
    // Get client token
    const tokenResponse = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken } = await tokenResponse.json();
    
    // Initialize v6 SDK
    const sdk = await window.paypal.createInstance({
      clientToken: accessToken,
      components: ['card-fields'],
      pageType: 'checkout'
    });
    
    // Check eligibility
    const methods = await sdk.findEligibleMethods();
    if (!methods.isEligible('advanced_cards')) {
      console.error('Card fields not eligible');
      return;
    }
    
    // Create session
    cardSession = sdk.createCardFieldsOneTimePaymentSession();
    
    // Create and mount components
    const numberField = cardSession.createCardFieldsComponent({ 
      type: 'number', 
      placeholder: 'Card number' 
    });
    const expiryField = cardSession.createCardFieldsComponent({ 
      type: 'expiry', 
      placeholder: 'MM/YY' 
    });
    const cvvField = cardSession.createCardFieldsComponent({ 
      type: 'cvv', 
      placeholder: 'CVV' 
    });
    
    document.querySelector('#paypal-card-fields-number').appendChild(numberField);
    document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
    document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
    
    // Handle submit
    document.getElementById('pay-button').addEventListener('click', onPayButtonClick);
    
  } catch (error) {
    console.error('SDK initialization error:', error);
  }
}

async function onPayButtonClick() {
  const payButton = document.getElementById('pay-button');
  const resultMessage = document.getElementById('result-message');
  const saveCard = document.getElementById('save-card-checkbox').checked;
  
  try {
    payButton.disabled = true;
    payButton.textContent = 'Processing...';
    
    // Create order with vault directive
    const orderResponse = await fetch('/paypal-api/checkout/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '100.00',
        currency: 'USD',
        saveCard: saveCard // Pass save preference to server
      })
    });
    
    const orderData = await orderResponse.json();
    
    // Submit session
    const { state, data } = await cardSession.submit(orderData.id, {
      billingAddress: { postalCode: '95131' }
    });
    
    switch (state) {
      case 'succeeded':
        // Capture order
        const captureResponse = await fetch(
          `/paypal-api/checkout/orders/${data.orderId}/capture`,
          { method: 'POST' }
        );
        
        const captureData = await captureResponse.json();
        
        // Extract vault data from capture response
        const vault = captureData?.payment_source?.card?.attributes?.vault;
        
        if (vault) {
          console.log('Card saved');
          console.log('Vault ID:', vault.id);
          console.log('Customer ID:', vault.customer.id);
          console.log('Card details:', {
            brand: captureData.payment_source.card.brand,
            lastDigits: captureData.payment_source.card.last_digits,
            expiry: captureData.payment_source.card.expiry
          });
          
          // Save vault IDs to your database
          await saveVaultToDatabase({
            userId: getCurrentUserId(),
            vaultId: vault.id,
            customerId: vault.customer.id,
            cardBrand: captureData.payment_source.card.brand,
            lastDigits: captureData.payment_source.card.last_digits,
            expiry: captureData.payment_source.card.expiry
          });
          
          resultMessage.textContent = 'Payment complete and card saved';
        } else {
          resultMessage.textContent = 'Payment complete';
        }
        
        resultMessage.style.color = 'green';
        setTimeout(() => { window.location.href = '/success'; }, 2000);
        break;
        
      case 'failed':
        resultMessage.textContent = 'Payment failed';
        resultMessage.style.color = 'red';
        payButton.disabled = false;
        payButton.textContent = 'Pay $100.00';
        break;
        
      case 'canceled':
        resultMessage.textContent = 'Payment was canceled';
        resultMessage.style.color = 'orange';
        payButton.disabled = false;
        payButton.textContent = 'Pay $100.00';
        break;
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    resultMessage.textContent = 'An error occurred';
    resultMessage.style.color = 'red';
    payButton.disabled = false;
    payButton.textContent = 'Pay $100.00';
  }
}

// Helper functions (implement based on your backend)
function getCurrentUserId() {
  // Return current user ID from your auth system
  return 'user123';
}

async function saveVaultToDatabase(vaultData) {
  // Save vault data to your database
  await fetch('/api/vault/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vaultData)
  });
}
```

## Server-Side: Order Creation with Vault

```javascript
const express = require('express');
const fetch = require('node-fetch');

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
      }]
    };
    
    // Add vault directive if user wants to save card
    if (saveCard) {
      orderBody.payment_source = {
        card: {
          attributes: {
            verification: {
              method: 'SCA_WHEN_REQUIRED'
            },
            vault: {
              store_in_vault: 'ON_SUCCESS',
              usage_type: 'MERCHANT', // or 'PLATFORM'
              customer_type: 'CONSUMER', // or 'BUSINESS'
              permit_multiple_payment_tokens: true
            }
          }
        }
      };
    }
    
    const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${Date.now()}-${Math.random().toString(36).substring(7)}`
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

## Server-Side: Order Capture (Extract Vault Data)

```javascript
app.post('/paypal-api/checkout/orders/:orderId/capture', async (req, res) => {
  try {
    const { orderId } = req.params;
    const accessToken = await getAccessToken();
    
    const captureResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const captureData = await captureResponse.json();
    
    // Extract vault information
    const vault = captureData?.payment_source?.card?.attributes?.vault;
    
    if (vault) {
      // Log vault details
      console.log('Vault Data:', {
        vaultId: vault.id,
        customerId: vault.customer.id,
        status: vault.status,
        cardBrand: captureData.payment_source.card.brand,
        lastDigits: captureData.payment_source.card.last_digits
      });
      
      // Save to database (implement your own function)
      await saveVaultToDatabase({
        orderId: captureData.id,
        vaultId: vault.id,
        customerId: vault.customer.id,
        cardDetails: {
          brand: captureData.payment_source.card.brand,
          lastDigits: captureData.payment_source.card.last_digits,
          expiry: captureData.payment_source.card.expiry
        }
      });
    }
    
    res.json(captureData);
    
  } catch (error) {
    console.error('Error capturing order:', error);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});
```

## Using Saved Card (Vault ID)

```javascript
// Create order with vault ID
app.post('/paypal-api/checkout/orders/create-with-vault', express.json(), async (req, res) => {
  try {
    const { amount, currency, vaultId } = req.body;
    const accessToken = await getAccessToken();
    
    // Create order using saved vault ID
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
            vault_id: vaultId // Use saved vault ID
          }
        }
      })
    });
    
    const orderData = await orderResponse.json();
    
    // Immediately capture since card is already saved
    const captureResponse = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderData.id}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const captureData = await captureResponse.json();
    res.json(captureData);
    
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});
```

## Important Notes

1. **Vault directive location**: `payment_source.card.attributes.vault`
2. **Vault data location**: Capture response, not order response
3. **Use vault.id**: For future payments, not order ID
4. **Client-side flow**: Same as regular card fields
5. **Server-side only**: Vaulting is configured on server
6. **3DS**: Use verification method with vaulting
7. **Multiple cards**: Use `permit_multiple_payment_tokens: true`

