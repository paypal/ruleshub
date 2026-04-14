#### List all balances

```js
async function listAllBalances() { 
  try { 
    const accessToken = await getPayPalAccessToken();
    const response = await axios.get(`${baseUrl}/v1/reporting/balances`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (err) { 
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```

> Note:When *RETURNALLCURRENCIES=0* in NVP, or *<ebl:ReturnAllCurrencies>false</ebl:ReturnAllCurrencies>* in SOAP, omit *currency_code* (or set it to your primary currency, e.g., USD).
