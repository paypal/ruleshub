#### Capturing payment for an Order

> Note: Always have an empty payload as request body while capturing payment for an order.

```php
function captureOrder($orderId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/checkout/orders/{$orderId}/capture";
        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
            'Content-Type: application/json',
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, '{}');
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to capture order');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to capture order');
        }
        error_log("Capture details for Order ID: {$orderId}");
        error_log(print_r($responseData, true));
        return $responseData['purchase_units'][0]['payments']['captures'][0]['id'];
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Authorizing an Order

```php
function authorizeOrder($orderId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/checkout/orders/{$orderId}/authorize";
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, '{}');
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to authorize order');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to authorize order');
        }
        return $responseData['purchase_units'][0]['payments']['authorizations'][0]['id'];
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```