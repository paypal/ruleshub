#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```js
// setup-subscription.js - Run once: node setup-subscription.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const baseUrl = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Include getPayPalAccessToken() from OAuth2 snippet

async function setupSubscriptionPlan() {
  const accessToken = await getPayPalAccessToken();
  
  // Step 1: Create Product
  const productRes = await axios.post(`${baseUrl}/v1/catalogs/products`, {
    name: 'Premium Subscription',  // Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
    type: 'SERVICE'  // Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
  }, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json'
    }
  });
  const productId = productRes.data.id;
  console.log('Product created:', productId);

  // Step 2: Create Plan
  // Build billing_cycles based on legacy code
  const billingCycles = [];
  let sequence = 1;

  // Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
  // Uncomment if legacy code has trial period:
  // billingCycles.push({
  //   tenure_type: 'TRIAL',
  //   sequence: sequence++,
  //   total_cycles: 1,  // Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES
  //   frequency: {
  //     interval_unit: 'DAY',  // Legacy equivalents — NVP: TRIALBILLINGPERIOD (Day→DAY, Week→WEEK, Month→MONTH, Year→YEAR)
  //     interval_count: 7      // Legacy equivalents — NVP: TRIALBILLINGFREQUENCY
  //   }
  //   // Omit pricing_scheme for free trial (TRIALAMT = 0)
  // });

  // Add REGULAR cycle (always present)
  billingCycles.push({
    tenure_type: 'REGULAR',
    sequence: sequence,
    total_cycles: 0,  // Legacy equivalents — NVP: TOTALBILLINGCYCLES (0 = unlimited)
    frequency: {
      interval_unit: 'MONTH',  // Legacy equivalents — NVP: BILLINGPERIOD (Day→DAY, Week→WEEK, Month→MONTH, Year→YEAR)
      interval_count: 1        // Legacy equivalents — NVP: BILLINGFREQUENCY
    },
    pricing_scheme: {
      fixed_price: {
        value: '29.99',       // Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
        currency_code: 'USD'  // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
      }
    }
  });

  // Build payment_preferences
  const paymentPreferences = {
    auto_bill_outstanding: true,   // Legacy equivalents — NVP: AUTOBILLOUTAMT (AddToNextBilling→true, NoAutoBill→false)
    payment_failure_threshold: 3   // Legacy equivalents — NVP: MAXFAILEDPAYMENTS
  };

  // Include setup_fee for:
  // - FLOW 1 (Subscription Only): if INITAMT > 0
  // - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
  // Uncomment if legacy has initial/one-time amount:
  // paymentPreferences.setup_fee = {
  //   value: '49.99',       // Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT
  //   currency_code: 'USD'
  // };

  const planRes = await axios.post(`${baseUrl}/v1/billing/plans`, {
    product_id: productId,
    name: 'Monthly Premium Plan',  // Legacy equivalents — NVP: DESC
    billing_cycles: billingCycles,
    payment_preferences: paymentPreferences
  }, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json'
    }
  });
  const planId = planRes.data.id;

  // Save to config file
  if (!fs.existsSync('./config')) fs.mkdirSync('./config');
  const config = { product_id: productId, plan_id: planId };
  fs.writeFileSync('./config/paypal-subscriptions.json', JSON.stringify(config, null, 2));
  
  console.log('Setup complete! Product:', productId, 'Plan:', planId);
  return config;
}

setupSubscriptionPlan().catch(err => {
  const errorInfo = err.response?.data || err.message;
  console.error('Setup failed:', errorInfo);
  if (errorInfo?.debug_id) console.error('Debug ID:', errorInfo.debug_id);
  process.exit(1);
});
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Each Customer Subscription)**

```js
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Load config from One-Time Setup
// Uses process.cwd() to find config relative to project root (where you run 'npm start' or 'node')
// This works even if this file is in a subfolder like src/services/
const CONFIG_PATH = process.env.PAYPAL_CONFIG_PATH || path.join(process.cwd(), 'config', 'paypal-subscriptions.json');
let PLAN_ID;
try {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  PLAN_ID = config.plan_id;
} catch (err) {
  throw new Error(`Config not found at ${CONFIG_PATH}. Run setup-subscription.js first, or set PAYPAL_CONFIG_PATH env var.`);
}

// Include getPayPalAccessToken() from OAuth2 snippet

// RUNTIME FLOW:
// 1. User clicks Subscribe → createSubscription() → redirect to PayPal
// 2. User approves on PayPal → PayPal redirects to return_url
// 3. Return handler → check status → activateSubscription()

/**
 * Create subscription and get approval URL.
 * @param {string} returnUrl - Where PayPal redirects after approval (Legacy: NVP RETURNURL)
 * @param {string} cancelUrl - Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)
 * @param {string} customId - Your reference ID (Legacy: NVP PROFILEREFERENCE)
 * @param {string} startTime - ISO 8601 start date (Legacy: NVP PROFILESTARTDATE). If null, starts immediately.
 */
async function createSubscription(returnUrl, cancelUrl, customId = null, startTime = null) {
  const accessToken = await getPayPalAccessToken();
  
  const subscriptionData = {
    plan_id: PLAN_ID,  // From config - NOT created per customer
    application_context: {
      user_action: 'CONTINUE',        // CRITICAL: Requires explicit activation after approval
      return_url: returnUrl,
      cancel_url: cancelUrl,
      brand_name: 'Your Company',     // Legacy equivalents — NVP: BRANDNAME
      shipping_preference: 'NO_SHIPPING'  // Legacy equivalents — NVP: NOSHIPPING (1→NO_SHIPPING, 0→GET_FROM_FILE)
    }
  };
  
  if (customId) subscriptionData.custom_id = customId;
  if (startTime) subscriptionData.start_time = startTime;
  
  const res = await axios.post(`${baseUrl}/v1/billing/subscriptions`, subscriptionData, {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': crypto.randomUUID(),
      'Content-Type': 'application/json'
    }
  });
  
  const approvalUrl = res.data.links.find(l => l.rel === 'approve')?.href;
  return { subscriptionId: res.data.id, approvalUrl };
}

/**
 * Get subscription status and details.
 */
async function getSubscriptionDetails(subscriptionId) {
  const accessToken = await getPayPalAccessToken();
  const res = await axios.get(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return res.data;
}

/**
 * Activate subscription after user approval.
 * CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
 * Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
 */
async function activateSubscription(subscriptionId) {
  const accessToken = await getPayPalAccessToken();
  await axios.post(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`, 
    { reason: 'Customer approved subscription' },
    { 
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Handle return from PayPal approval page.
 * Call this in your return_url route handler.
 */
async function handleSubscriptionReturn(subscriptionId) {
  const details = await getSubscriptionDetails(subscriptionId);
  const status = details.status;
  
  if (status === 'APPROVED') {
    await activateSubscription(subscriptionId);
    return { success: true, status: 'ACTIVE' };
  } else if (status === 'ACTIVE') {
    return { success: true, status: 'ACTIVE', message: 'Already activated' };
  } else {
    return { success: false, status, message: `Unexpected status: ${status}` };
  }
}
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```js
// Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
const billingCycles = [
  {
    tenure_type: 'TRIAL',
    sequence: 1,
    total_cycles: 1,
    frequency: { interval_unit: 'DAY', interval_count: 7 }
    // No pricing_scheme = free trial (TRIALAMT = 0)
  },
  {
    tenure_type: 'REGULAR',
    sequence: 2,
    total_cycles: 0,
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    pricing_scheme: {
      fixed_price: { value: '29.99', currency_code: 'USD' }
    }
  }
];
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```js
// Legacy FLOW 1: INITAMT=49.99 → setup_fee
// Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
const paymentPreferences = {
  auto_bill_outstanding: true,
  payment_failure_threshold: 3,
  setup_fee: {
    value: '49.99',       // Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
    currency_code: 'USD'
  }
};

const billingCycles = [{
  tenure_type: 'REGULAR',
  sequence: 1,
  total_cycles: 0,
  frequency: { interval_unit: 'MONTH', interval_count: 1 },
  pricing_scheme: {
    fixed_price: { value: '29.99', currency_code: 'USD' }  // Legacy: NVP AMT
  }
}];
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```js
// Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
// Charge sequence: setup_fee at activation → trial period → regular billing

const billingCycles = [
  {
    tenure_type: 'TRIAL',
    sequence: 1,
    total_cycles: 1,
    frequency: { interval_unit: 'DAY', interval_count: 7 }
    // No pricing_scheme = free trial (TRIALAMT = 0)
  },
  {
    tenure_type: 'REGULAR',
    sequence: 2,
    total_cycles: 0,
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    pricing_scheme: {
      fixed_price: { value: '29.99', currency_code: 'USD' }  // Legacy: NVP AMT
    }
  }
];

const paymentPreferences = {
  auto_bill_outstanding: true,
  payment_failure_threshold: 3,
  setup_fee: {
    value: '49.99',       // Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
    currency_code: 'USD'
  }
};
```
