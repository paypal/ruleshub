#### SNIPPET-MRPPS

**Manage Subscription Status (replaces ManageRecurringPaymentsProfileStatus)**

> REST has three separate endpoints based on action:
> - Suspend: `POST /v1/billing/subscriptions/{id}/suspend`
> - Cancel: `POST /v1/billing/subscriptions/{id}/cancel`
> - Reactivate: `POST /v1/billing/subscriptions/{id}/activate`

**Suspend Subscription**

```php
/**
 * Suspend subscription (temporarily pause billing)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Suspend
 * 
 * @param string $subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param string $reason Reason for suspension (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
 */
function suspendSubscription($subscriptionId, $reason) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v1/billing/subscriptions/' . $subscriptionId . '/suspend';
    $accessToken = getPayPalAccessToken();
    
    $payload = ['reason' => $reason];
    
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
    
    if ($httpCode >= 300) {
        $responseData = json_decode($response, true);
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error suspending subscription: " . $response);
    }
    
    echo "Subscription suspended\n";
}
```

**Cancel Subscription**

```php
/**
 * Cancel subscription (permanently end - cannot be undone)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Cancel
 * 
 * @param string $subscriptionId REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param string $reason Reason for cancellation (required in REST). Legacy equivalents — NVP: NOTE; SOAP: Note
 */
function cancelSubscription($subscriptionId, $reason) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v1/billing/subscriptions/' . $subscriptionId . '/cancel';
    $accessToken = getPayPalAccessToken();
    
    $payload = ['reason' => $reason];
    
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
    
    if ($httpCode >= 300) {
        $responseData = json_decode($response, true);
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error cancelling subscription: " . $response);
    }
    
    echo "Subscription cancelled\n";
}
```

**Reactivate Subscription**

```php
/**
 * Reactivate subscription (resume from suspended state)
 * Legacy equivalents — NVP: ManageRecurringPaymentsProfileStatus with ACTION=Reactivate
 * Note: This is the same endpoint used for initial activation after buyer approval
 * 
 * @param string $subscriptionId REST subscription ID. Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param string $reason Reason for reactivation. Legacy equivalents — NVP: NOTE; SOAP: Note
 */
function reactivateSubscription($subscriptionId, $reason) 
{
    global $paypalHostname;
    $url = $paypalHostname . '/v1/billing/subscriptions/' . $subscriptionId . '/activate';
    $accessToken = getPayPalAccessToken();
    
    $payload = ['reason' => $reason];
    
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
    
    if ($httpCode >= 300) {
        $responseData = json_decode($response, true);
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error reactivating subscription: " . $response);
    }
    
    echo "Subscription reactivated\n";
}
```
