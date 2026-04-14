#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```py
def view_transaction(transaction_id):
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
        }
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=7)
        end_time = now - timedelta(days=1)
        params = {
            'start_date': start_time.isoformat(), # Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
            'end_date': end_time.isoformat(), # Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
            'transaction_id': transaction_id, # Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
        }
        response = requests.get(
            f'{baseUrl}/v1/reporting/transactions',
            headers=headers,
            params=params
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

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```py
def transaction_search():
    try:
        access_token = get_paypal_access_token()
        headers = {
            'Authorization': f'Bearer {access_token}',
        }
        now = datetime.now(timezone.utc)
        start_time = now - timedelta(days=7)
        end_time = now - timedelta(days=1)
        params = {
            'start_date': start_time.isoformat(), # Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
            'end_date': end_time.isoformat(), # Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        }
        response = requests.get(
            f'{baseUrl}/v1/reporting/transactions',
            headers=headers,
            params=params
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