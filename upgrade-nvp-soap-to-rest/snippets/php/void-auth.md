#### Void an Authorization

> Note: A status code of 204 is returned when the **Prefer** header is set to *return=minimal* (default behavior).
> A status code of 200 is returned when the **Prefer** header is set to *return=representation*. 

```php
function voidAuth($authId) {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = "{$paypalHostname}/v2/payments/authorizations/{$authId}/void";
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
            throw new Exception('Failed to void auth');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($httpCode === 204 || $httpCode === 200) {
            return true;
        }
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to void auth');
        }
        return false;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```