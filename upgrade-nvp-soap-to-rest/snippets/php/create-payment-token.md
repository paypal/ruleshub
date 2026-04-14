#### Exchanging temporary setup token for a payment token

```php
// `$setupTokenId` is the setup token created with the `POST /v3/vault/setup-tokens` call.
function createPaymentToken($setupTokenId) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v3/vault/payment-tokens';
    $accessToken = getPayPalAccessToken();
    $payload = [
        "payment_source" => [
            "token" => [
                "id" => $setupTokenId,
                "type" => "SETUP_TOKEN"
            ]
        ]
    ];
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken,
        'PayPal-Request-Id' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
    ];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error creating payment token: " . $response);
    }
    return $responseData;
}
```