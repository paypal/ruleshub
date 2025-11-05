#### Refund the pending captured amount

> Note: Send an empty request body to initiate a refund for the amount equal to [captured amount – refunds already issued].

```php
function refundTransaction($transactionId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/captures/{$transactionId}/refund";
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
            throw new Exception('Failed to refund transaction');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to refund transaction');
        }
        return $responseData['id'];
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Refund specific amount

> Note: Include the specific amount in the request body to initiate a refund for that amount against the capture.

```php
function refundTransactionPartial($transactionId, $amount) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/captures/{$transactionId}/refund";
        $payload = [
            'amount' => [
                'currency_code' => 'USD', // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: Amount.currencyID
                'value' => $amount // Legacy equivalents — NVP: AMT ; SOAP: Amount
            ]
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
            throw new Exception('Failed to refund partial transaction');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to refund partial transaction');
        }
        return $responseData['id'];
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```