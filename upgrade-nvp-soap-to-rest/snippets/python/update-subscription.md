#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```python
import uuid
import requests

# Include get_paypal_access_token() from OAuth2 snippet

def update_subscription(subscription_id, patch_operations):
    """
    Update subscription
    Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
    
    Args:
        subscription_id: REST subscription ID (starts with I-)
                        Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
        patch_operations: JSON Patch operations array
    """
    try:
        access_token = get_paypal_access_token()
        response = requests.patch(
            f'{baseUrl}/v1/billing/subscriptions/{subscription_id}',
            json=patch_operations,
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
        return response.json() if response.text else None
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```

**Update billing amount (20% limit applies)**

```python
def update_billing_amount(subscription_id, amount, currency_code='USD'):
    """
    Update subscription billing amount
    Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
    Note: Can only increase by 20% max per 180-day interval
    """
    patch_operations = [{
        'op': 'replace',
        'path': '/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price',
        'value': {
            'currency_code': currency_code,  # NVP: CURRENCYCODE
            'value': amount                  # NVP: AMT
        }
    }]
    return update_subscription(subscription_id, patch_operations)
```

**Update shipping amount**

```python
def update_shipping_amount(subscription_id, amount, currency_code='USD'):
    """
    Update subscription shipping amount
    Legacy equivalents — NVP: SHIPPINGAMT; SOAP: ShippingAmount
    """
    patch_operations = [{
        'op': 'replace',
        'path': '/shipping_amount',
        'value': { 'currency_code': currency_code, 'value': amount }
    }]
    return update_subscription(subscription_id, patch_operations)
```
