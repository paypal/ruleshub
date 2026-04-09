#### Setting up webhook for persisting vaulted payment source id

> To learn more, refer to [Create Webhook](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_post) and [List webhooks](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks_list).

```php
function createWebhook($webhookUrl) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        // List existing webhooks
        $listUrl = $paypalHostname . '/v1/notifications/webhooks';
        $ch = curl_init($listUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ]);
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            throw new Exception('Curl error: ' . curl_error($ch));
        }
        $listData = json_decode($response, true);
        curl_close($ch);
        foreach ($listData['webhooks'] ?? [] as $webhook) {
            if ($webhook['url'] === $webhookUrl) {
                error_log("Found existing webhook:");
                return $webhook;
            }
        }
        // Create a new webhook if it doesn't exist
        $createUrl = $paypalHostname . '/v1/notifications/webhooks';
        $payload = [
            'url' => $webhookUrl,
            'event_types' => [
                ['name' => 'VAULT.PAYMENT-TOKEN.CREATED']
            ]
        ];
        $ch = curl_init($createUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if (curl_errno($ch)) {
            throw new Exception('Curl error: ' . curl_error($ch));
        }
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception("Failed to create webhook with status code: $httpCode");
        }
        
        return $responseData;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Webhook signature verification

> To learn more, refer to [Verify Webhook Signatures](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post).

```php
function verifyWebhookSignature($webhookId, $headers, $body) {
    $token = getPayPalAccessToken();
    $verificationData = [
        'auth_algo' => $headers['paypal-auth-algo'] ?? '',
        'cert_url' => $headers['paypal-cert-url'] ?? '',
        'transmission_id' => $headers['paypal-transmission-id'] ?? '',
        'transmission_sig' => $headers['paypal-transmission-sig'] ?? '',
        'transmission_time' => $headers['paypal-transmission-time'] ?? '',
        'webhook_id' => $webhookId,
        'webhook_event' => json_decode($body, true)
    ];
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $paypalHostname . '/v1/notifications/verify-webhook-signature',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($verificationData),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token
        ]
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    $result = json_decode($response, true);
    return $result['verification_status'] === 'SUCCESS';
}
```

#### Webhook handler to capture and store "VaultId" from the event data

> To learn more, refer to [Show event notification details](https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events_get).

```php
function webhookHandler($webhookId, $headers, $body) {
    $isVerified = verifyWebhookSignature($webhookId, $headers, $body);
    if (!$isVerified) {
        throw new Exception('Webhook verification failed');
    }
    $event = json_decode($body);
    if ($event->event_type === 'VAULT.PAYMENT-TOKEN.CREATED') {
        // This is the unique identifier associated with the customer's payment source stored in the PayPal Vault.
        // This "vaultId" can be used to make future payments without needing customer's consent.
        $vaultId = $event->resource->id; 
        // TODO: Save the vaultId to the database.
        return $vaultId;
    }
    throw new Exception('Invalid webhook event');
}
```