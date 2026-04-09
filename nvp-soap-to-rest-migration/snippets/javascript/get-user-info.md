#### Show user profile details

```js
async function getUserInfo() { 
  try { 
    const accessToken = await getPayPalAccessToken();
    const response = await axios.get(`${baseUrl}/v1/identity/openidconnect/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      params: {
        schema: 'openid',
      },
    });
    return response.data;
  } catch (err) { 
    console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
    throw err;
  }
}
```