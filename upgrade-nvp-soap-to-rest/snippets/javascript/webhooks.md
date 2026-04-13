#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```js
async function createWebhook(webhookUrl) {
    try {
        const accessToken = await getPayPalAccessToken();
        const listWebhooksUrl = `${baseUrl}/v1/notifications/webhooks`;
        const listResponse = await axios.get(listWebhooksUrl, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const existingWebhook = listResponse.data.webhooks.find(webhook => webhook.url === webhookUrl);
        if (existingWebhook) {
            console.log("Found existing webhook:", existingWebhook);
            return existingWebhook;
        }
        const createWebhookUrl = `${baseUrl}/v1/notifications/webhooks`;
        const payload = {
            url: webhookUrl,
            event_types: [
                {
                    name: "VAULT.PAYMENT-TOKEN.CREATED"
                }
            ]
        };
        const res = await axios.post(createWebhookUrl, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
                "PayPal-Request-Id": crypto.randomUUID(),
            },
        });
        return res.data;
    } catch (err) {
        console.log(`Error debug id: ${err?.response?.data?.debug_id}`);
        throw err;
    }
}
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```js
async verifyWebhookSignature(headers, body) {
    const token = await getPayPalAccessToken();
    const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: JSON.parse(body)
    };
    const response = await axios.post(`${baseUrl}/v1/notifications/verify-webhook-signature`,
        verificationData,
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }
    );
    const result = await response.json();
    return result.verification_status === 'SUCCESS';
    }
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```js
async function webhookHandler(webhookId, headers, body) { 
    const isVerified = await verifyWebhookSignature(webhookId, headers, body);
    if (!isVerified) {
        throw new Error('Webhook verification failed');
    }
    const event = JSON.parse(body);
    if (event.event_type === 'VAULT.PAYMENT-TOKEN.CREATED') {
        // This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
        // This "vaultId" can be used to make future payments without needing customer's consent.
        const vaultId = event.resource.id; 
        // TODO: Save the vaultId to the database.
        return vaultId;
    }
    throw new Error('Invalid webhook event');
}
```