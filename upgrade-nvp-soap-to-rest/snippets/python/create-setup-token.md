#### Create a new setup token

```py
def create_setup_token():
    try:
        access_token = get_paypal_access_token()
        url = f"{baseUrl}/v3/vault/setup-tokens"
        payload = {
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "shipping_preference": "SET_PROVIDED_ADDRESS", # Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
                        "brand_name": "EXAMPLE INC", # Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
                        "locale": "en-US", # Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                        "return_url": "https://example.com/returnUrl", # Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                        "cancel_url": "https://example.com/cancelUrl" # Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                    },
                    "usage_pattern": "IMMEDIATE", # Only available in REST APIs
                    "usage_type": "MERCHANT" # Only available in REST APIs
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
        json_response = response.json()
        setup_token_id = json_response.get("id")
        approval_url = None
        if "links" in json_response:
            for link in json_response["links"]:
                if link.get("rel") == "approve":
                    approval_url = link.get("href")
                    break
        return {"setup_token_id": setup_token_id, "approval_url": approval_url}
    except requests.exceptions.RequestException as err:
        print(f"Error debug id: {err.response.json().get('debug_id') if err.response else 'N/A'}")
        raise 
```