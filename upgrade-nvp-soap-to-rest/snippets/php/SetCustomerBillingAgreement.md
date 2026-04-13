#### SNIPPET-SetCustomerBA

**Create a setup token for billing agreement (Flow B Migration)**

>  **Legacy Context:** This replaces the deprecated `SetCustomerBillingAgreement` API (deprecated since version 54.0). The legacy API returned tokens with "RP-" prefix. The modern API returns setup token IDs.

```php
function createSetupTokenForBillingAgreement() 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v3/vault/setup-tokens';
    $accessToken = getPayPalAccessToken();
    
    $payload = [
        "payment_source" => [
            "paypal" => [
                "description" => "Monthly subscription for premium service", // Legacy equivalents — NVP: L_BILLINGAGREEMENTDESCRIPTIONn; SOAP: BillingAgreementDetails.BillingAgreementDescription
                "experience_context" => [
                    "return_url" => "https://example.com/return", // Legacy equivalents — NVP: RETURNURL; SOAP: ReturnURL
                    "cancel_url" => "https://example.com/cancel", // Legacy equivalents — NVP: CANCELURL; SOAP: CancelURL
                    "locale" => "en-US" // Legacy equivalents — NVP: LOCALECODE; SOAP: LocaleCode
                ],
                "usage_pattern" => "IMMEDIATE", // Only available in REST APIs
                "usage_type" => "MERCHANT" // Only available in REST APIs
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
    
    error_log("Setup Token Created: " . $setupTokenId);
    error_log("Redirect customer to: " . $approvalUrl);
    
    return [
        'setupTokenId' => $setupTokenId,
        'approvalUrl' => $approvalUrl
    ];
}
```

**Migration Notes:**

- **Legacy Fields NOT Supported:**
  - `BILLINGTYPE` / `BillingAgreementDetails.BillingType` - Handled by vault endpoint structure
  - `PAGESTYLE`, `HDRIMG`, `HDRBACKCOLOR`, etc. - UI customization not available in v3
  - `L_BILLINGAGREEMENTCUSTOMn` - Custom metadata not supported
  - `EMAIL` / `BuyerEmail` - Not required in vault setup

- **Authentication:** Replace `USER`, `PWD`, `SIGNATURE` with OAuth 2.0 access token

- **Token Format:** Legacy returned "RP-{token}" format. REST returns a setup token ID.

- **Webhook Required:** Set up webhook for `VAULT.PAYMENT-TOKEN.CREATED` event to capture the payment token ID after customer approval.

