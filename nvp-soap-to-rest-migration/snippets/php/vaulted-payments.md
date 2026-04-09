#### Creating a "CAPTURE" order with vaulted payment

```php
function captureReferenceTransaction($vaultId, $amount, $currencyCode) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = $paypalHostname . '/v2/checkout/orders';
        $payload = [
            'intent' => 'CAPTURE', // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            'purchase_units' => [
                [
                    'amount' => [
                        'currency_code' => $currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        'value' => $amount, // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    ],
                ],
            ],
            'payment_source' => [
                'paypal' => [
                    'vault_id' => $vaultId, // Used in place of legacy payload's BILLINGAGREEMENTID.
                ],
            ],
        ];
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
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to create order for reference transaction');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to create order for reference transaction');
        }
        $orderId = $responseData['id'];
        return $responseData;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Creating a "AUTHORIZE" order with vaulted payment

```php
 function authorizeAndCaptureReferenceTransaction($vaultId, $amount, $currencyCode) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = $paypalHostname . '/v2/checkout/orders';
        $payload = [
            'intent' => 'AUTHORIZE', // Legacy equivalents — NVP: PAYMENTACTION ; SOAP: PaymentAction
            'purchase_units' => [
                [
                    'amount' => [
                        'currency_code' => $currencyCode, // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        'value' => $amount, // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    ],
                ],
            ],
            'payment_source' => [
                'paypal' => [
                    'vault_id' => $vaultId, // Used in place of legacy payload's BILLINGAGREEMENTID.
                ],
            ],
        ];
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
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to authorize reference transaction');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to authorize reference transaction');
        }
        $authorizationId = $responseData['purchase_units'][0]['payments']['authorizations'][0]['id'];
        $captureDetails = captureAuthorization($authorizationId);
        return $captureDetails;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```