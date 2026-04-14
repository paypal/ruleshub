#### OAuth2.0 Authentication

```php
function getPayPalAccessToken() {
    static $tokenCache = null;
    if ($tokenCache && $tokenCache['expires'] > time()) {
        return $tokenCache['token'];
    }
    $clientId = $_ENV['PAYPAL_CLIENT_ID'];
    $clientSecret = $_ENV['PAYPAL_CLIENT_SECRET'];
    $auth = base64_encode($clientId . ':' . $clientSecret);
    global $paypalHostname;
    $url = $paypalHostname . '/v1/oauth2/token';
    $headers = [
        'Authorization: Basic ' . $auth,
        'Content-Type: application/x-www-form-urlencoded',
        'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
    ];
    $postData = 'grant_type=client_credentials';
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
        curl_close($ch);
        throw new Exception('Failed to get access token');
    }
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception('Failed to get access token');
    }
    $tokenCache = [
        'token' => $responseData['access_token'],
        'expires' => time() + $responseData['expires_in'] - 60 // 1 minute buffer
    ];
    return $responseData['access_token'];
}
```