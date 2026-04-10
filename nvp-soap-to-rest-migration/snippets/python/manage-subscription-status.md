#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```python
import uuid
import requests

# Include get_paypal_access_token() from OAuth2 snippet

def suspend_subscription(subscription_id, reason):
    """
    Suspend subscription (temporarily pause billing)
    Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
    
    Args:
        subscription_id: Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
        reason: Required in REST. Legacy equivalents — NVP: NOTE; SOAP: Note
    """
    try:
        access_token = get_paypal_access_token()
        response = requests.post(
            f'{baseUrl}/v1/billing/subscriptions/{subscription_id}/suspend',
            json={'reason': reason},
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```

**Cancel Subscription**

```python
def cancel_subscription(subscription_id, reason):
    """
    Cancel subscription (permanently end - cannot be undone)
    Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
    
    Args:
        subscription_id: Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
        reason: Required in REST. Legacy equivalents — NVP: NOTE; SOAP: Note
    """
    try:
        access_token = get_paypal_access_token()
        response = requests.post(
            f'{baseUrl}/v1/billing/subscriptions/{subscription_id}/cancel',
            json={'reason': reason},
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```

**Reactivate Subscription**

```python
def reactivate_subscription(subscription_id, reason):
    """
    Reactivate subscription (resume from suspended state)
    Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
    Note: Same endpoint as initial activation after buyer approval
    
    Args:
        subscription_id: Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
        reason: Legacy equivalents — NVP: NOTE; SOAP: Note
    """
    try:
        access_token = get_paypal_access_token()
        response = requests.post(
            f'{baseUrl}/v1/billing/subscriptions/{subscription_id}/activate',
            json={'reason': reason},
            headers={
                'Authorization': f'Bearer {access_token}',
                'PayPal-Request-Id': str(uuid.uuid4()),
                'Content-Type': 'application/json'
            }
        )
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"Error debug id: {e.response.json().get('debug_id') if e.response else None}")
        raise
```
