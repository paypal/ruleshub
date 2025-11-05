#### Create a new setup token

```php
function createSetupToken()
{
    global $paypalHostname;
    $url = $paypalHostname . '/v3/vault/setup-tokens';
    $accessToken = getPayPalAccessToken();
    $payload = [
        "payment_source" => [
            "paypal" => [
                "experience_context" => [
                    "shipping_preference" => "SET_PROVIDED_ADDRESS", // Legacy equivalents — NVP: ADDROVERRIDE; SOAP: AddressOverride
                    "brand_name" => "EXAMPLE INC", // Legacy equivalents — NVP: BRANDNAME; SOAP: BrandName
                    "locale" => "en-US", // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                    "return_url" => "https://example.com/returnUrl", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                    "cancel_url" => "https://example.com/cancelUrl" // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                ],
                "usage_pattern" => "IMMEDIATE", // Only available in REST APIs
                "usage_type" => "MERCHANT", // Only available in REST APIs
            ]
        ]
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
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error creating setup token: " . $response);
    }
    $setupTokenId = $responseData['id'];
    $approvalUrl = null;
    foreach ($responseData['links'] as $link) {
        if ($link['rel'] === 'approve') {
            $approvalUrl = $link['href'];
            break;
        }
    }
    return ['setupTokenId' => $setupTokenId, 'approvalUrl' => $approvalUrl];
} 
```