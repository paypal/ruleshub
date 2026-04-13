#### Show user profile details

```php
function getUserInfo() {
    try {
        $accessToken = getPayPalAccessToken();
        global $paypalHostname;
        $url = $paypalHostname . '/v1/identity/openidconnect/userinfo?schema=openid';
        $headers = [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/x-www-form-urlencoded',
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to get user info');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to get user info');
        }
        return $responseData;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```