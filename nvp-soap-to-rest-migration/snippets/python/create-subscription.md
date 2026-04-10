#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```python
# setup_subscription.py
# macOS/Linux: pip3 install requests python-dotenv && python3 setup_subscription.py
# Windows:     pip install requests python-dotenv && python setup_subscription.py
import os
import json
import uuid
import requests
from dotenv import load_dotenv

load_dotenv()

baseUrl = 'https://api-m.paypal.com' if os.getenv('PAYPAL_MODE') == 'live' else 'https://api-m.sandbox.paypal.com'

# Include get_paypal_access_token() from OAuth2 snippet

def setup_subscription_plan():
    """One-Time Setup: Create Product and Plan - RUN ONCE, save plan_id to config"""
    access_token = get_paypal_access_token()
    headers = {
        'Authorization': f'Bearer {access_token}',
        'PayPal-Request-Id': str(uuid.uuid4()),
        'Content-Type': 'application/json'
    }
    
    # Step 1: Create Product
    product_data = {
        'name': 'Premium Subscription',  # Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
        'type': 'SERVICE'  # Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
    }
    
    response = requests.post(f'{baseUrl}/v1/catalogs/products', json=product_data, headers=headers)
    response.raise_for_status()
    product_id = response.json()['id']
    print(f'Product created: {product_id}')
    
    # Step 2: Create Plan
    # Build billing_cycles based on legacy code
    billing_cycles = []
    sequence = 1
    
    # Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
    # Uncomment if legacy code has trial period:
    # billing_cycles.append({
    #     'tenure_type': 'TRIAL',
    #     'sequence': sequence,
    #     'total_cycles': 1,  # Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES; SOAP: TrialPeriod.TotalBillingCycles
    #     'frequency': {
    #         'interval_unit': 'DAY',   # Legacy equivalents — NVP: TRIALBILLINGPERIOD (Day→DAY, Week→WEEK, Month→MONTH, Year→YEAR)
    #         'interval_count': 7       # Legacy equivalents — NVP: TRIALBILLINGFREQUENCY
    #     }
    #     # Omit pricing_scheme for free trial (TRIALAMT = 0)
    #     # Include pricing_scheme if TRIALAMT > 0
    # })
    # sequence += 1
    
    # Add REGULAR cycle (always present)
    billing_cycles.append({
        'tenure_type': 'REGULAR',
        'sequence': sequence,
        'total_cycles': 0,  # Legacy equivalents — NVP: TOTALBILLINGCYCLES; SOAP: PaymentPeriod.TotalBillingCycles (0 = unlimited)
        'frequency': {
            'interval_unit': 'MONTH',  # Legacy equivalents — NVP: BILLINGPERIOD (Day→DAY, Week→WEEK, Month→MONTH, Year→YEAR)
            'interval_count': 1        # Legacy equivalents — NVP: BILLINGFREQUENCY
        },
        'pricing_scheme': {
            'fixed_price': {
                'value': '29.99',  # Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
                'currency_code': 'USD'  # Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
            }
        }
    })
    
    # Build payment_preferences
    payment_preferences = {
        'auto_bill_outstanding': True,  # Legacy equivalents — NVP: AUTOBILLOUTAMT (AddToNextBilling→True, NoAutoBill→False)
        'payment_failure_threshold': 3  # Legacy equivalents — NVP: MAXFAILEDPAYMENTS; SOAP: MaxFailedPayments
    }
    
    # Include setup_fee for:
    # - FLOW 1 (Subscription Only): if INITAMT > 0
    # - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
    # Uncomment if legacy has initial/one-time amount:
    # payment_preferences['setup_fee'] = {
    #     'value': '49.99',  # Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT
    #     'currency_code': 'USD'
    # }
    
    plan_data = {
        'product_id': product_id,
        'name': 'Monthly Premium Plan',  # Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
        'billing_cycles': billing_cycles,
        'payment_preferences': payment_preferences
    }
    
    headers['PayPal-Request-Id'] = str(uuid.uuid4())
    response = requests.post(f'{baseUrl}/v1/billing/plans', json=plan_data, headers=headers)
    response.raise_for_status()
    plan_id = response.json()['id']
    
    # Save to config file
    os.makedirs('./config', exist_ok=True)
    config = {'product_id': product_id, 'plan_id': plan_id}
    with open('./config/paypal-subscriptions.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f'Setup complete! Product: {product_id}, Plan: {plan_id}')
    return config


if __name__ == '__main__':
    try:
        setup_subscription_plan()
    except requests.exceptions.HTTPError as e:
        error_info = e.response.json() if e.response else str(e)
        print(f'Setup failed: {error_info}')
        if isinstance(error_info, dict) and 'debug_id' in error_info:
            print(f"Debug ID: {error_info['debug_id']}")
        exit(1)
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Each Customer Subscription)**

```python
# subscription_service.py
import os
import json
import uuid
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

baseUrl = 'https://api-m.paypal.com' if os.getenv('PAYPAL_MODE') == 'live' else 'https://api-m.sandbox.paypal.com'

# Load config from One-Time Setup
# Uses project root (where you run 'python') to find config
# This works even if this file is in a subfolder like src/services/
PROJECT_ROOT = Path(__file__).resolve().parent
# Walk up to find config - handles nested directories
while not (PROJECT_ROOT / 'config' / 'paypal-subscriptions.json').exists() and PROJECT_ROOT.parent != PROJECT_ROOT:
    PROJECT_ROOT = PROJECT_ROOT.parent
CONFIG_PATH = os.getenv('PAYPAL_CONFIG_PATH') or str(PROJECT_ROOT / 'config' / 'paypal-subscriptions.json')

try:
    with open(CONFIG_PATH, 'r') as f:
        config = json.load(f)
    PLAN_ID = config['plan_id']
except FileNotFoundError:
    raise Exception(f'Config not found at {CONFIG_PATH}. Run setup_subscription.py first, or set PAYPAL_CONFIG_PATH env var.')

# Include get_paypal_access_token() from OAuth2 snippet

# RUNTIME FLOW:
# 1. User clicks Subscribe → create_subscription() → redirect to PayPal
# 2. User approves on PayPal → PayPal redirects to return_url
# 3. Return handler → check status → activate_subscription()

def create_subscription(return_url, cancel_url, custom_id=None, start_time=None):
    """
    Create subscription and get approval URL.
    
    Args:
        return_url: Where PayPal redirects after approval (Legacy: NVP RETURNURL)
        cancel_url: Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)
        custom_id: Your reference ID (Legacy: NVP PROFILEREFERENCE)
        start_time: ISO 8601 start date (Legacy: NVP PROFILESTARTDATE). If None, starts immediately after activation.
    """
    access_token = get_paypal_access_token()
    
    subscription_data = {
        'plan_id': PLAN_ID,  # From config - NOT created per customer
        'application_context': {
            'user_action': 'CONTINUE',  # CRITICAL: Requires explicit activation after approval
            'return_url': return_url,
            'cancel_url': cancel_url,
            'brand_name': 'Your Company',  # Legacy equivalents — NVP: BRANDNAME
            'shipping_preference': 'NO_SHIPPING'  # Legacy equivalents — NVP: NOSHIPPING (1→NO_SHIPPING, 0→GET_FROM_FILE)
        }
    }
    
    if custom_id:
        subscription_data['custom_id'] = custom_id
    
    if start_time:
        subscription_data['start_time'] = start_time
    
    response = requests.post(
        f'{baseUrl}/v1/billing/subscriptions',
        json=subscription_data,
        headers={
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()
    data = response.json()
    
    approval_url = next((link['href'] for link in data.get('links', []) if link['rel'] == 'approve'), None)
    return {'subscription_id': data['id'], 'approval_url': approval_url}


def get_subscription_details(subscription_id):
    """Get subscription status and details."""
    access_token = get_paypal_access_token()
    response = requests.get(
        f'{baseUrl}/v1/billing/subscriptions/{subscription_id}',
        headers={'Authorization': f'Bearer {access_token}'}
    )
    response.raise_for_status()
    return response.json()


def activate_subscription(subscription_id):
    """
    Activate subscription after user approval.
    CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
    Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
    """
    access_token = get_paypal_access_token()
    response = requests.post(
        f'{baseUrl}/v1/billing/subscriptions/{subscription_id}/activate',
        json={'reason': 'Customer approved subscription'},
        headers={
            'Authorization': f'Bearer {access_token}',
            'PayPal-Request-Id': str(uuid.uuid4()),
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()


def handle_subscription_return(subscription_id):
    """
    Handle return from PayPal approval page.
    Call this in your return_url route handler.
    """
    details = get_subscription_details(subscription_id)
    status = details.get('status')
    
    if status == 'APPROVED':
        activate_subscription(subscription_id)
        return {'success': True, 'status': 'ACTIVE'}
    elif status == 'ACTIVE':
        return {'success': True, 'status': 'ACTIVE', 'message': 'Already activated'}
    else:
        return {'success': False, 'status': status, 'message': f'Unexpected status: {status}'}
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```python
# Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
#         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
billing_cycles = [
    {
        'tenure_type': 'TRIAL',
        'sequence': 1,
        'total_cycles': 1,
        'frequency': {'interval_unit': 'DAY', 'interval_count': 7}
        # No pricing_scheme = free trial (TRIALAMT = 0)
    },
    {
        'tenure_type': 'REGULAR',
        'sequence': 2,
        'total_cycles': 0,
        'frequency': {'interval_unit': 'MONTH', 'interval_count': 1},
        'pricing_scheme': {
            'fixed_price': {'value': '29.99', 'currency_code': 'USD'}
        }
    }
]
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```python
# Legacy FLOW 1: INITAMT=49.99 → setup_fee
# Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
payment_preferences = {
    'auto_bill_outstanding': True,
    'payment_failure_threshold': 3,
    'setup_fee': {
        'value': '49.99',      # Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
        'currency_code': 'USD'
    }
}

billing_cycles = [{
    'tenure_type': 'REGULAR',
    'sequence': 1,
    'total_cycles': 0,
    'frequency': {'interval_unit': 'MONTH', 'interval_count': 1},
    'pricing_scheme': {
        'fixed_price': {'value': '29.99', 'currency_code': 'USD'}  # Legacy: NVP AMT
    }
}]
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```python
# Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
#         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
# Charge sequence: setup_fee at activation → trial period → regular billing

billing_cycles = [
    {
        'tenure_type': 'TRIAL',
        'sequence': 1,
        'total_cycles': 1,
        'frequency': {'interval_unit': 'DAY', 'interval_count': 7}
        # No pricing_scheme = free trial (TRIALAMT = 0)
    },
    {
        'tenure_type': 'REGULAR',
        'sequence': 2,
        'total_cycles': 0,
        'frequency': {'interval_unit': 'MONTH', 'interval_count': 1},
        'pricing_scheme': {
            'fixed_price': {'value': '29.99', 'currency_code': 'USD'}  # Legacy: NVP AMT
        }
    }
]

payment_preferences = {
    'auto_bill_outstanding': True,
    'payment_failure_threshold': 3,
    'setup_fee': {
        'value': '49.99',       # Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
        'currency_code': 'USD'
    }
}
```
