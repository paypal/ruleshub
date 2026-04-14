#### Get Order Details

```js
async function getOrderDetails(orderId) { 
    try {
        const accessToken = await getPayPalAccessToken();
        const response = await axios.get(`${baseUrl}/v2/checkout/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });
        return response.data;
    } catch (err) { 
        console.log(`Error debug id: ${err.response.data.debug_id}`);
        throw err;
    }
}
```