#### Create an order

```php
function createOrder() {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = $paypalHostname . '/v2/checkout/orders';
        $payload = [
            'intent' => 'CAPTURE', // Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
            'purchase_units' => [
                [
                    'amount' => [
                        'currency_code' => 'USD', // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
                        'value' => '10.00', // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
                    ],
                ],
            ],
            'payment_source' => [
                'paypal' => [
                    'experience_context' => [
                        'return_url' => 'https://example.com/return', // Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
                        'cancel_url' => 'https://example.com/cancel' // Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
                    ],
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
            throw new Exception('Failed to create order');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to create order');
        }
        $orderId = $responseData['id'];
        $approvalUrl = null;
        if (isset($responseData['links'])) {
            foreach ($responseData['links'] as $link) {
                if ($link['rel'] === 'approve' || $link['rel'] === 'payer-action') {
                    $approvalUrl = $link['href'];
                    break;
                }
            }
        }
        return ['orderId' => $orderId, 'approvalUrl' => $approvalUrl];
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```