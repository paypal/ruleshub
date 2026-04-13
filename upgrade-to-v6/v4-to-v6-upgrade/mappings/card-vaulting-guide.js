/**
 * PayPal Card Vaulting Integration Guide for v6 SDK
 * Save cards for future payments
 * Based on: https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault
 */

const CARD_VAULTING_GUIDE = `
## Card Vaulting (Save Payment Methods) with v6 SDK

**This guide is specifically for developers migrating from PayPal checkout.js v4 to v6 SDK.**
Card Vaulting with the v2 Orders API did NOT exist in checkout.js v4 - this is a completely new capability available in v6.


### Overview
Card vaulting allows you to securely save customer credit and debit cards for future transactions. PayPal encrypts and stores the card information, so you never handle sensitive data directly, maintaining PCI compliance.

**Note: This guide is for v6 SDK. The v6 SDK uses different patterns than v4.**

### When to Use Card Vaulting

Card vaulting is suitable when:
- You need to charge customers on a recurring basis (subscriptions, memberships)
- You want to offer one-click checkout for returning customers
- You're building a service that bills customers periodically
- You need to store payment methods for future manual charges
- You want to reduce checkout friction for repeat purchases

### When to Consider Alternatives

- **For one-time payments**: Standard Card Fields integration is simpler
- **For guest checkout**: Standalone Payment Buttons may be sufficient
- **For PayPal account vaulting**: Use PayPal Vault/Billing Agreements
- **For complex billing**: Consider Subscription APIs for automated recurring billing

### Key Features
- **PCI Compliant**: PayPal handles all sensitive data storage
- **Vault with or without purchase**: Save during checkout or separately
- **3DS Support**: Authenticate cards during vaulting process
- **Multiple cards per customer**: Allow customers to save multiple payment methods
- **Vault ID management**: Receive unique IDs for each saved card

---

## Two Vaulting Flows

### 1. Save Card WITH Purchase (Recommended)
Customer makes a payment AND saves their card for future use.

### 2. Save Card WITHOUT Purchase
Customer saves card without making a payment (requires Setup Tokens API).

---

## Flow 1: Save Card WITH Purchase

### Step 1: Generate Client Token (Server-Side)

**Important:** v6 SDK requires a browser-safe client token.

\`\`\`javascript
// Node.js/Express - Generate client token endpoint
app.get('/paypal-api/auth/browser-safe-client-token', async (req, res) => {
  try {
    const auth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
    
    // Get access token
    const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': \`Basic \${auth}\`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const { access_token } = await tokenResponse.json();
    
    // Generate client token
    const clientTokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/identity/generate-token', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${access_token}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const { client_token } = await clientTokenResponse.json();
    res.json({ accessToken: client_token });
    
  } catch (error) {
    console.error('Error generating client token:', error);
    res.status(500).json({ error: 'Failed to generate client token' });
  }
});
\`\`\`

### Step 2: HTML Setup with v6 SDK Script

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PayPal Card Vaulting</title>
  <!-- Important: v6 SDK Core Script -->
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
</head>
<body>
  <div id="checkout-form">
    <h2>Payment Details</h2>
    
    <!-- Card field containers -->
    <div id="paypal-card-fields-number"></div>
    <div id="paypal-card-fields-expiry"></div>
    <div id="paypal-card-fields-cvv"></div>
    
    <!-- Save card checkbox -->
    <div>
      <input type="checkbox" id="save-card-checkbox" name="save-card">
      <label for="save-card-checkbox">Save card for future purchases</label>
    </div>
    
    <button id="submit-button" type="button">Pay Now</button>
  </div>
</body>
</html>
\`\`\`

### Step 3: Client-Side Integration (v6 Pattern)

\`\`\`javascript
let cardSession;

// This function is called when v6 SDK loads
async function onPayPalWebSdkLoaded() {
  try {
    // 1. Get browser-safe client token from your server
    const tokenResponse = await fetch('/paypal-api/auth/browser-safe-client-token');
    const { accessToken } = await tokenResponse.json();
    
    // 2. Initialize v6 SDK with client token
    const sdk = await window.paypal.createInstance({
      clientToken: accessToken,
      components: ['card-fields'],
      pageType: 'checkout'
    });
    
    // 3. Check eligibility for card fields
    const paymentMethods = await sdk.findEligibleMethods();
    const isCardFieldsEligible = paymentMethods.isEligible('advanced_cards');
    
    if (!isCardFieldsEligible) {
      console.error('Card fields are not eligible');
      alert('Card payments are not available. Please try another payment method.');
      return;
    }
    
    // 4. Create card fields session
    cardSession = sdk.createCardFieldsOneTimePaymentSession();
    
    // 5. Create individual card field components (v6 way)
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
    
    // 6. Mount components to DOM (v6 uses appendChild, NOT render())
    document.querySelector('#paypal-card-fields-number').appendChild(numberField);
    document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
    document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
    
    // 7. Handle submit with vault option
    const submitButton = document.getElementById('submit-button');
    const saveCardCheckbox = document.getElementById('save-card-checkbox');
    
    submitButton.addEventListener('click', async () => {
      try {
        // Create order with vault directive
        const orderResponse = await fetch('/api/paypal/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: '100.00',
            currency: 'USD',
            saveCard: saveCardCheckbox.checked // Pass save preference
          })
        });
        
        const orderData = await orderResponse.json();
        const orderId = orderData.id;
        
        // Submit session with order ID (v6 pattern)
        const { state, data } = await cardSession.submit(orderId, {
          billingAddress: {
            postalCode: '95131' // Optional but recommended
          }
        });
        
        // Handle response with switch statement
        switch (state) {
          case 'succeeded':
            // Capture order
            const captureResponse = await fetch(\`/api/paypal/orders/\${data.orderId}/capture\`, {
              method: 'POST'
            });
            
            const captureData = await captureResponse.json();
            
            // Extract vault information from capture response
            const vault = captureData?.payment_source?.card?.attributes?.vault;
            
            if (vault) {
              console.log('Card saved successfully!');
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
              
              alert('Payment successful and card saved!');
            } else {
              alert('Payment successful!');
            }
            
            window.location.href = '/success';
            break;
            
          case 'failed':
            console.error('Payment failed:', data);
            alert('Payment failed. Please try again.');
            break;
            
          case 'canceled':
            console.log('Payment canceled by user');
            alert('Payment was canceled.');
            break;
            
          default:
            console.warn('Unexpected state:', state);
            break;
        }
        
      } catch (error) {
        console.error('Payment error:', error);
        alert('An error occurred. Please try again.');
      }
    });
    
  } catch (error) {
    console.error('SDK initialization error:', error);
    alert('Failed to load payment form. Please refresh the page.');
  }
}
\`\`\`

### Step 4: Server-Side Order Creation with Vault

**Important:** The vault directive should be placed in \`payment_source.card.attributes\`.

\`\`\`javascript
// Node.js/Express - Create order with vault directive
app.post('/api/paypal/orders/create', async (req, res) => {
  const { amount, currency, saveCard } = req.body;
  
  // Get access token
  const auth = Buffer.from(\`\${process.env.PAYPAL_CLIENT_ID}:\${process.env.PAYPAL_CLIENT_SECRET}\`).toString('base64');
  
  const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${auth}\`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Build order body
  const orderBody = {
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency || 'USD',
        value: amount
      }
    }]
  };
  
  // Important: Add vault directive if user wants to save card
  if (saveCard) {
    orderBody.payment_source = {
      card: {
        attributes: {
          verification: {
            method: 'SCA_WHEN_REQUIRED' // 3DS for security
          },
          vault: {
            store_in_vault: 'ON_SUCCESS', // Vault after successful payment
            usage_type: 'MERCHANT', // MERCHANT or PLATFORM
            customer_type: 'CONSUMER', // CONSUMER or BUSINESS
            permit_multiple_payment_tokens: true // Allow multiple cards per customer
          }
        }
      }
    };
  }
  
  // Create order
  const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': generateUniqueRequestId() // For idempotency
    },
    body: JSON.stringify(orderBody)
  });
  
  const orderData = await orderResponse.json();
  res.json(orderData);
});

// Helper function for unique request ID
function generateUniqueRequestId() {
  return \`\${Date.now()}-\${Math.random().toString(36).substring(7)}\`;
}
\`\`\`

### Step 5: Capture Order and Extract Vault Data

**Important:** Vault data is available in the capture response, not the order creation response.

\`\`\`javascript
// Capture order endpoint
app.post('/api/paypal/orders/:orderId/capture', async (req, res) => {
  const { orderId } = req.params;
  
  // Get access token (reuse function from above)
  const access_token = await getAccessToken();
  
  // Capture order
  const captureResponse = await fetch(\`https://api-m.sandbox.paypal.com/v2/checkout/orders/\${orderId}/capture\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    }
  });
  
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
});
\`\`\`

---

## Using Saved Cards (Vault ID)

### Step 1: List Saved Payment Methods

\`\`\`javascript
// Get all saved cards for a customer
app.get('/api/paypal/vault/payment-tokens', async (req, res) => {
  const { customerId } = req.query;
  
  const access_token = await getAccessToken();
  
  const response = await fetch(\`https://api-m.sandbox.paypal.com/v3/vault/payment-tokens?customer_id=\${customerId}\`, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  res.json(data);
});
\`\`\`

### Step 2: Display Saved Cards to Customer

\`\`\`html
<div id="saved-cards">
  <h3>Your Saved Cards</h3>
  <div id="saved-cards-list"></div>
</div>
\`\`\`

\`\`\`javascript
// Display saved cards
async function displaySavedCards() {
  const response = await fetch(\`/api/paypal/vault/payment-tokens?customerId=\${customerId}\`);
  const { payment_tokens } = await response.json();
  
  const container = document.getElementById('saved-cards-list');
  
  payment_tokens.forEach(token => {
    const cardInfo = token.payment_source.card;
    
    const cardElement = document.createElement('div');
    cardElement.className = 'saved-card';
    cardElement.innerHTML = \`
      <input type="radio" name="payment-method" value="\${token.id}">
      <label>
        \${cardInfo.brand} •••• \${cardInfo.last_digits}
        <small>Exp: \${cardInfo.expiry}</small>
      </label>
    \`;
    
    container.appendChild(cardElement);
  });
}
\`\`\`

### Step 3: Charge Saved Card (Vault ID)

\`\`\`javascript
// Server-side: Create order with vault ID
app.post('/api/paypal/orders/create-with-vault', async (req, res) => {
  const { amount, currency, vaultId } = req.body;
  
  const access_token = await getAccessToken();
  
  // Create order using saved vault ID
  const orderResponse = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
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
  const captureResponse = await fetch(\`https://api-m.sandbox.paypal.com/v2/checkout/orders/\${orderData.id}/capture\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    }
  });
  
  const captureData = await captureResponse.json();
  res.json(captureData);
});
\`\`\`

### Step 4: Client-Side - Pay with Saved Card

\`\`\`javascript
// Pay with saved card - NO card fields needed!
async function payWithSavedCard(vaultId) {
  try {
    const response = await fetch('/api/paypal/orders/create-with-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: '50.00',
        currency: 'USD',
        vaultId: vaultId
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'COMPLETED') {
      alert('Payment successful!');
      window.location.href = '/success';
    } else {
      alert('Payment failed. Please try again.');
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('An error occurred. Please try again.');
  }
}
\`\`\`

---

## Managing Saved Cards

### Delete a Saved Card

\`\`\`javascript
// Delete payment token
app.delete('/api/paypal/vault/payment-tokens/:tokenId', async (req, res) => {
  const { tokenId } = req.params;
  
  const access_token = await getAccessToken();
  
  const response = await fetch(\`https://api-m.sandbox.paypal.com/v3/vault/payment-tokens/\${tokenId}\`, {
    method: 'DELETE',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status === 204) {
    res.json({ success: true, message: 'Card deleted successfully' });
  } else {
    res.status(response.status).json({ success: false, message: 'Failed to delete card' });
  }
});
\`\`\`

---

## Complete Vaulting Example with v6 SDK

\`\`\`html
<!DOCTYPE html>
<html>
  <head>
  <meta charset="UTF-8">
  <title>PayPal Card Vaulting - v6 SDK</title>
  <!-- Important: Load v6 SDK -->
  <script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>
<body>
  <div id="checkout-form">
    <h2>Payment Details</h2>
    
    <!-- v6 SDK card field containers -->
    <div id="paypal-card-fields-number"></div>
    <div id="paypal-card-fields-expiry"></div>
    <div id="paypal-card-fields-cvv"></div>
    
    <div>
      <input type="checkbox" id="save-card-checkbox">
      <label for="save-card-checkbox">Save this card for future purchases</label>
    </div>
    
    <button id="submit-button">Pay $100.00</button>
  </div>
  
  <script>
    let cardSession;
    
    // CRITICAL: Called when v6 SDK loads
    async function onPayPalWebSdkLoaded() {
      try {
        // Get client token from server
        const tokenRes = await fetch('/paypal-api/auth/browser-safe-client-token');
        const { accessToken } = await tokenRes.json();
        
        // Initialize v6 SDK
        const sdk = await window.paypal.createInstance({
          clientToken: accessToken,
          components: ['card-fields'],
          pageType: 'checkout'
        });
        
        // Check eligibility
        const methods = await sdk.findEligibleMethods();
        if (!methods.isEligible('advanced_cards')) {
          alert('Card payments not available');
          return;
        }
        
        // Create session
        cardSession = sdk.createCardFieldsOneTimePaymentSession();
        
        // Create card field components (v6 way)
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
        
        // Mount to DOM (v6 uses appendChild)
        document.querySelector('#paypal-card-fields-number').appendChild(numberField);
        document.querySelector('#paypal-card-fields-expiry').appendChild(expiryField);
        document.querySelector('#paypal-card-fields-cvv').appendChild(cvvField);
        
        // Handle submit
        document.getElementById('submit-button').addEventListener('click', async () => {
          const saveCard = document.getElementById('save-card-checkbox').checked;
          
          try {
            // Create order
            const orderRes = await fetch('/api/paypal/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: '100.00',
                currency: 'USD',
                saveCard: saveCard
              })
            });
            
            const order = await orderRes.json();
            
            // Submit session (v6 pattern)
            const { state, data } = await cardSession.submit(order.id, {
              billingAddress: { postalCode: '95131' }
            });
            
            // Handle states
            switch (state) {
              case 'succeeded':
                // Capture
                const captureRes = await fetch(\`/api/paypal/orders/\${data.orderId}/capture\`, {
                  method: 'POST'
                });
                
                const capture = await captureRes.json();
                
                // Check vault data
                const vault = capture?.payment_source?.card?.attributes?.vault;
                if (vault) {
                  console.log('Card saved! Vault ID:', vault.id);
                  console.log('Customer ID:', vault.customer.id);
                }
                
                alert('Payment successful!');
                window.location.href = '/success';
                break;
                
              case 'failed':
                alert('Payment failed. Please try again.');
                break;
                
              case 'canceled':
                alert('Payment was canceled.');
                break;
            }
          } catch (err) {
            console.error(err);
            alert('Error processing payment');
          }
        });
        
      } catch (error) {
        console.error('SDK initialization error:', error);
        alert('Failed to load payment form');
      }
    }
  </script>
</body>
</html>
\`\`\`

---


**Key Fields:**
- \`vault.id\`: Use this to charge the card in future
- \`vault.customer.id\`: PayPal's customer identifier
- \`vault.status\`: VAULTED, APPROVED, etc.
- \`card.brand\`: VISA, MASTERCARD, AMEX, etc.
- \`card.last_digits\`: Last 4 digits for display
- \`card.expiry\`: Card expiration date

---

## Troubleshooting

### Issue 1: No Vault Data in Capture Response
**Solution:**
- Verify \`store_in_vault: 'ON_SUCCESS'\` in order creation
- Check vault permissions in PayPal dashboard
- Ensure payment was successful before vaulting

### Issue 2: Vault ID Not Working for Future Payments
**Solution:**
- Verify vault ID is correct
- Check card hasn't expired
- Ensure using same merchant account

### Issue 3: Multiple Cards Not Saving
**Solution:**
- Set \`permit_multiple_payment_tokens: true\`
- Use unique customer IDs
- Check vault limits for your account

---

## Resources

- [Card Vaulting Documentation](https://docs.paypal.ai/payments/save/sdk/cards/js-sdk-v6-vault)
- [Vault API Reference](https://docs.paypal.ai/payments/save/api/vault-api-integration)
- [Payment Tokens API](https://developer.paypal.com/docs/api/payment-tokens/v3/)
- [v6 SDK Documentation](https://docs.paypal.ai/payments/methods/cards/js-sdk-v6-card-fields-one-time)

---

## v6 SDK Implementation Requirements

**Script Loading:**
- Use: \`<script async src="https://www.sandbox.paypal.com/web-sdk/v6/core" onload="onPayPalWebSdkLoaded()"></script>\`

**Client Token:**
- Generate client token from backend
- Avoid: Using client ID directly in frontend

**SDK Initialization:**
- Use: \`window.paypal.createInstance({ clientToken, components: ['card-fields'] })\`

**Eligibility Check:**
- Use: \`sdk.findEligibleMethods().isEligible('advanced_cards')\`

**Component Creation:**
- Use: \`session.createCardFieldsComponent({ type: 'number' })\`

**Component Mounting:**
- Use: \`element.appendChild(component)\`

**Submit Pattern:**
- Create order first, then call \`session.submit(orderId, options)\`
- Returns: \`{ state, data }\` promise

**State Handling:**
- Use switch statement with cases: \`succeeded\`, \`failed\`, \`canceled\`
- Include \`break;\` in each case
- Avoid: if/else chains with callbacks

**Vault Data Location:**
- Vault data is in capture response: \`captureData.payment_source.card.attributes.vault\`
- Not available in order creation response

**Vault Directive Location:**
- Server-side placement: \`payment_source.card.attributes.vault\`
- Include \`store_in_vault: 'ON_SUCCESS'\` parameter

**Common Migration Considerations:**
- \`session.isEligible()\` does not exist on session objects
- Client token generation from backend is required
- Vault data is only available after successful capture
- Switch case statements should include \`break;\` to prevent fall-through

`;

module.exports = { CARD_VAULTING_GUIDE };

