#### Void an authorization

> Note: A status code of 204 is returned when the **Prefer** header is set to *return=minimal* (default behavior).
> A status code of 200 is returned when the **Prefer** header is set to *return=representation*. 

```js
async function voidAuth(authId) { 
    try { 
        const accessToken = await getPayPalAccessToken();
        const response = await axios.post(`${baseUrl}/v2/payments/authorizations/${authId}/void`,{}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': crypto.randomUUID(),
            },
        });
        if(response.status === 204 || response.status === 200) { 
            return true;
        }
        return false;
    } catch (err) { 
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```