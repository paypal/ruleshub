#### Generate Client Token for v6 SDK

```php
<?php

function getAccessToken($grantType = 'client_credentials') {
    $clientId = getenv('PAYPAL_CLIENT_ID');
    $clientSecret = getenv('PAYPAL_CLIENT_SECRET');
    $paypalBase = getenv('PAYPAL_BASE') ?: 'https://api-m.sandbox.paypal.com';
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$paypalBase/v1/oauth2/token");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_USERPWD, "$clientId:$clientSecret");
    curl_setopt($ch, CURLOPT_POSTFIELDS, "grant_type=$grantType");
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception('Failed to get access token');
    }
    
    $data = json_decode($response, true);
    return $data['access_token'];
}

function getBrowserSafeClientToken() {
    try {
        $accessToken = getAccessToken('client_credentials&response_type=client_token&intent=sdk_init');
        
        header('Content-Type: application/json');
        echo json_encode([
            'accessToken' => $accessToken
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'TOKEN_GENERATION_FAILED'
        ]);
    }
}
?>
```

