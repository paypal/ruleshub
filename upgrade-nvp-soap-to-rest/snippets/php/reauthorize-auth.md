#### Reauthorizing the full amount that was authorized before

> Note: Sending a reauthorization request with an empty body will reauthorize the full amount of the previously authorized order.

```php
// The authorizationId parameter must be the original identifier returned when the order was first authorized.
function reauthorizeAuth($authorizationId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/authorizations/{$authorizationId}/reauthorize";
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
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
            throw new Exception('Failed to reauthorize auth');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to reauthorize auth');
        }
        return $responseData['id']; // ID for the reauthorized authorization.
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Reauthorizing part of the amount that was authorized before

> Note: Include the amount field in the reauthorization request body to reauthorize a specific amount, which must not exceed the originally authorized value.

```php
function reauthorizeAuthPartial($authorizationId, $amount) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/authorizations/{$authorizationId}/reauthorize";
        $payload = [
            'amount' => [
                'currency_code' => "USD", // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Not Supported
                'value' => $amount, // Legacy equivalents — NVP: AMT; SOAP: Amount
            ],
        ];
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
            'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to reauthorize partial auth');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to reauthorize partial auth');
        }
        return $responseData['id']; // ID for the reauthorized authorization.
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```