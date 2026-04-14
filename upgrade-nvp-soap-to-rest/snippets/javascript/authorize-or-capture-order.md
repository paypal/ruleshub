#### Capturing payment for an Order

> Note: Always have an empty payload as request body while capturing payment for an order.

```js
async function captureOrder(orderId) { 
  try { 
    const accessToken = await getPayPalAccessToken();
    const response = await axios.post(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {}, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': crypto.randomUUID(),
        'Content-Type': 'application/json',
      }
    });
    return response.data.purchase_units[0].payments.captures[0].id;
  } catch (err) { 
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```

#### Authorizing an Order

```js
async function authorizeOrder(orderId) { 
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await axios.post(`${baseUrl}/v2/checkout/orders/${orderId}/authorize`,{}, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': crypto.randomUUID(),
        },
      }
    );
    return response.data.purchase_units[0].payments.authorizations[0].id;
  } catch (err) { 
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```