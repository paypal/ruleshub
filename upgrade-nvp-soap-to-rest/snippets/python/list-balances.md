#### List all balances

```py
def list_all_balances():
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
        }
        response = requests.get(
            f'{baseUrl}/v1/reporting/balances',
            headers=headers
        )
        response.raise_for_status()
        return response.json()
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

> Note:When *RETURNALLCURRENCIES=0* in NVP, or *<ebl:ReturnAllCurrencies>false</ebl:ReturnAllCurrencies>* in SOAP, omit *currency_code* (or set it to your primary currency, e.g., USD).
