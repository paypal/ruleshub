#### SNIPPET-GetBACustomerDetails

**Retrieve setup token details (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `GetBillingAgreementCustomerDetails` API. **Critical:** The legacy API returned extensive customer information. The modern API returns token status but NOT detailed customer info.

```py
def get_setup_token_details(setup_token_id):
    """
        Retrieve setup token details.
        WARNING: This does NOT return customer information like the legacy API did.
    """
    try:
        access_token = get_paypal_access_token()
        url = f"{baseUrl}/v3/vault/setup-tokens/{setup_token_id}"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        setup_token = response.json()
        print(f"Setup Token Status: {setup_token.get('status')}")
        
        return setup_token
        
    except requests.exceptions.RequestException as err:
        error_debug_id = err.response.json().get('debug_id') if err.response else 'N/A'
        print(f"Error debug id: {error_debug_id}")
        raise
```

** Critical Migration Warning: Customer Data NOT Available**

The legacy `GetBillingAgreementCustomerDetails` API returned:
-  Customer email, name, address (NVP: ALL fields unsupported)
-  Customer email, name, address (SOAP: SOME fields available in payment token response)
-  Payer ID, payer status
-  Shipping information

**The modern REST API response includes:**
-  Setup token status and ID
-  Payment source type
-  Links for approval and other actions
-  NO customer personal information in this call

**Migration Strategy:**

1. **For NVP Users:** You MUST store customer information in your own database before redirecting to PayPal. The REST API will not return this data.

2. **For SOAP Users:** Some customer data is available after creating the payment token:
```py
def get_payment_token_details(payment_token_id):
    """Get limited customer info from payment token (SOAP migration path)"""
    access_token = get_paypal_access_token()
    url = f"{baseUrl}/v3/vault/payment-tokens/{payment_token_id}"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    
    # Available fields:
    payment_source = data.get('payment_source', {}).get('paypal', {})
    customer_data = {
        'email': payment_source.get('email_address'),
        'accountId': payment_source.get('account_id'),
        'name': payment_source.get('name', {}).get('full_name'),
        'address': payment_source.get('address')
    }
    
    return customer_data
```

3. **Alternative:** Use PayPal Identity APIs after customer authorization to get detailed customer information.

**Fields NOT Available in v3 (Plan Accordingly):**

**NVP Response - ALL UNSUPPORTED:**
- `EMAIL`, `FIRSTNAME`, `LASTNAME`, `PAYERID`, `PAYERSTATUS`
- `COUNTRYCODE`, `ADDRESSSTATUS`, `PAYERBUSINESS`
- `SHIPTONAME`, `SHIPTOSTREET`, `SHIPTOCITY`, `SHIPTOSTATE`, `SHIPTOZIP`

**SOAP Response - PARTIALLY SUPPORTED:**
- `PayerInfo.Payer` maps to `payment_source.paypal.email_address`
- `PayerInfo.PayerID` maps to `payment_source.paypal.account_id`
- `PayerInfo.Address.*` maps to `payment_source.paypal.address.*`
- `PayerInfo.PayerStatus`, `PayerInfo.PayerBusiness` - Not supported
- Separate first/last/middle names - Only full_name available

