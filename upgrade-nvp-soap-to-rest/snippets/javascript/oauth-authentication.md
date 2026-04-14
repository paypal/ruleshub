#### OAuth2.0 Authentication

```js
var tokenCache = new Map();
const getPayPalAccessToken = async () => {
  try { 
    const cached = tokenCache.get('access_token');
    if (cached && cached.expires > Date.now()) {
      return cached.token;
    }
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(`${baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    tokenCache.set('access_token', {
      token: response.data.access_token,
      expires: Date.now() + (response.data.expires_in * 1000) - 60000 // 1 minute buffer
    });
    return response.data.access_token;   
  } catch (err) { 
    console.log(`Error debug id: ${err.response.data.debug_id}`);
    throw err;
  }
};
```