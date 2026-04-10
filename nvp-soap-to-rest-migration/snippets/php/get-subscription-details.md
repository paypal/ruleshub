#### SNIPPET-GRPPD

**Get Subscription Details (replaces GetRecurringPaymentsProfileDetails)**

> REST equivalent: `GET /v1/billing/subscriptions/{subscription_id}`

```php
/**
 * Get subscription details
 * Legacy equivalents — NVP: GetRecurringPaymentsProfileDetails; SOAP: GetRecurringPaymentsProfileDetails
 * 
 * @param string $subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @return array Subscription details including status, billing_info, subscriber
 */
function getSubscriptionDetails($subscriptionId) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v1/billing/subscriptions/' . $subscriptionId;
    $accessToken = getPayPalAccessToken();
    
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken,
        'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error getting subscription details: " . $response);
    }
    
    return $responseData;
}
```

**Get Plan Details (optional - if full billing cycle config needed)**

> Call this if subscription response doesn't include full billing cycle configuration

```php
/**
 * Get plan details
 * 
 * @param string $planId Plan ID from subscription.plan_id
 */
function getPlanDetails($planId) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v1/billing/plans/' . $planId;
    $accessToken = getPayPalAccessToken();
    
    $headers = [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken,
        'PayPal-Request-Id: ' . vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4))
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error getting plan details: " . $response);
    }
    
    return $responseData;
}
```
