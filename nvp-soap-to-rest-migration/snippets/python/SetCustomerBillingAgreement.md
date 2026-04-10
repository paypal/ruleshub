#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```py
def create_setup_token_for_billing_agreement():
    """
        Create a setup token for billing agreement without initial purchase.
        This replaces the deprecated SetCustomerBillingAgreement API.
    """
    try:
        access_token = get_paypal_access_token()
        url = f"{baseUrl}/v3/vault/setup-tokens"
        
        payload = {
            "payment_source": {
                "paypal": {
                    "description": "Monthly subscription for premium service",  # Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
                    "experience_context": {
                        "return_url": "https://example.com/return",  # Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        "cancel_url": "https://example.com/cancel",  # Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                        "locale": "en-US"  # Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                    },
                    "usage_pattern": "IMMEDIATE",  # Only available in REST APIs
                    "usage_type": "MERCHANT"  # Only available in REST APIs
                }
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "PayPal-Request-Id": str(uuid.uuid4())
        }
        
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        setup_token_id = data['id']
        approval_url = next((link['href'] for link in data.get('links', []) if link['rel'] == 'approve'), None)
        
        print(f"Setup Token Created: {setup_token_id}")
        print(f"Redirect customer to: {approval_url}")
        
        return {
            'setupTokenId': setup_token_id,
            'approvalUrl': approval_url
        }
        
    except requests.exceptions.RequestException as err:
        error_debug_id = err.response.json().get('debug_id') if err.response else 'N/A'
        print(f"Error debug id: {error_debug_id}")
        raise
```

**Migration Notes:**

- **Legacy Fields NOT Supported:**
  - `BILLINGTYPE` / `BillingAgreementDetails.BillingType` - Handled by vault endpoint structure
  - `PAGESTYLE`, `HDRIMG`, `HDRBACKCOLOR`, etc. - UI customization not available in v3
  - `L_BILLINGAGREEMENTCUSTOMn` - Custom metadata not supported
  - `EMAIL` / `BuyerEmail` - Not required in vault setup

- **Authentication:** Replace `USER`, `PWD`, `SIGNATURE` with OAuth 2.0 access token

- **Token Format:** Legacy returned "RP-{token}" format. REST returns a setup token ID.

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval.

