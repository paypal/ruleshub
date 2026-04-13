#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```python
import uuid
import requests

# Include get_paypal_access_token() from OAuth2 snippet

def get_subscription_details(subscription_id):
    """
    Get subscription details
    Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
    
    Args:
        subscription_id: REST subscription ID (starts with I-)
                        Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
    """
    try:
        access_token = get_paypal_access_token()
        response = requests.get(
            f'{baseUrl}/v1/billing/subscriptions/{subscription_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```

**Get Plan Details (optional - if full billing cycle config needed)**

```python
def get_plan_details(plan_id):
    """Get plan details if subscription response doesn't include full billing config"""
    try:
        access_token = get_paypal_access_token()
        response = requests.get(
            f'{baseUrl}/v1/billing/plans/{plan_id}',
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```
