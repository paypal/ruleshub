#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```js
async function viewTransaction(transactionId) { 
  try {
    const accessToken = await getPayPalAccessToken();
    const now = new Date();
    const endTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const startTime = new Date(now.getTime() - (24 * 2 * 60 * 60 * 1000));
    const params = {
      start_date: startTime.toISOString(), // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
      end_date: endTime.toISOString(), // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
      transaction_id: transactionId, // Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
    };
    const response = await axios.get(`${baseUrl}/v1/reporting/transactions`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      params: params
    });
    return response.data;
  } catch (err) {
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```js
async function transactionSearch() { 
  try { 
    const accessToken = await getPayPalAccessToken();
    const now = new Date();
    const endTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const startTime = new Date(now.getTime() - (24 * 2 * 60 * 60 * 1000));
    const params = {
      start_date: startTime.toISOString(), // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
      end_date: endTime.toISOString(), // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
    };
    const response = await axios.get(`${baseUrl}/v1/reporting/transactions`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      params: params
    });
    return response.data;
  } catch (err) { 
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```