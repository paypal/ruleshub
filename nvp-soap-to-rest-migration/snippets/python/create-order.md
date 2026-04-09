#### Create an order

```py
def create_order():
    try:
        access_token = get_paypal_access_token()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
            "PayPal-Request-Id": str(uuid.uuid4()),
        }
        payload = {
            "intent": "CAPTURE", # Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": "USD", # Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        "value": "10.00", # Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    },
                },
            ],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "return_url": "https://example.com/return", # Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
                        "cancel_url": "https://example.com/cancel" # Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
                    }
                }
            },
        }
        response = requests.post(
            f"{baseUrl}/v2/checkout/orders",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        response_data = response.json()
        order_id = response_data['id']
        approval_url = None
        for link in response_data.get('links', []):
            if link.get('rel') in ('approve', 'payer-action'):
                approval_url = link['href']
                break
        return {"order_id": order_id, "approval_url": approval_url}
    except requests.exceptions.RequestException as err:
        if err.response:
            try:
                print(f"Error debug id: {err.response.json().get('debug_id')}")
            except Exception:
                print(f"Error getting debug id from response: {err.response.text}")
        else:
            print("Request failed without a response.")
        raise err 
```