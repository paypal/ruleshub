#### Capturing full authorized amount

> Note: Use the capture authorization endpoint with an empty request body to capture the entire authorized amount and treat it as the final capture.

```php
function captureAuthorization($authorizationId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/authorizations/{$authorizationId}/capture";
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
            throw new Exception('Failed to capture authorization');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to capture authorization');
        }
        return $responseData['id']; // Returns the ID assigned for the captured payment.
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Capturing part of the authorized amount

> Note: For partial captures, specify amount to be captured and set "final_capture" explicitly to false.

```php
function captureAuthorizationPartial($authorizationId, $amount, $finalCapture = true) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/authorizations/{$authorizationId}/capture";
        
        $payload = [
            'amount' => [
                'currency_code' => 'USD', // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                'value' => $amount, // Legacy equivalents — NVP: AMT; SOAP: Amount
            ],
            'final_capture' => $finalCapture, // Legacy equivalents — NVP: COMPLETETYPE; SOAP: CompleteType
        ];
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
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to capture partial authorization');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to capture partial authorization');
        }
        return $responseData['id']; // Returns the ID assigned for the captured payment.
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```