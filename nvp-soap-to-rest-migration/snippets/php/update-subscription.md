#### SNIPPET-URPP

**Update Subscription (replaces UpdateRecurringPaymentsProfile)**

> REST equivalent: `PATCH /v1/billing/subscriptions/{subscription_id}`

```php
/**
 * Update subscription
 * Legacy equivalents — NVP: UpdateRecurringPaymentsProfile; SOAP: UpdateRecurringPaymentsProfile
 * 
 * @param string $subscriptionId REST subscription ID (starts with I-). Legacy equivalents — NVP: PROFILEID; SOAP: ProfileID
 * @param array $patchOperations JSON Patch operations array
 * @return array Updated subscription
 */
function updateSubscription($subscriptionId, $patchOperations) 
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
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PATCH");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($patchOperations));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    
    $responseData = json_decode($response, true);
    if ($httpCode >= 300) {
        error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
        throw new Exception("Error updating subscription: " . $response);
    }
    
    return $responseData;
}
```

**Update billing amount (20% limit applies)**

```php
/**
 * Update subscription billing amount
 * Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
 * 
 * Note: Can only increase by 20% maximum per 180-day interval
 * Note: Cannot update within 3 days of scheduled billing date
 */
function updateBillingAmount($subscriptionId, $amount, $currencyCode = 'USD') 
{
    $patchOperations = [
        [
            'op' => 'replace',
            'path' => '/plan/billing_cycles/@sequence==1/pricing_scheme/fixed_price',
            'value' => [
                'currency_code' => $currencyCode, // Legacy equivalents — NVP: CURRENCYCODE; SOAP: Amount.currencyID
                'value' => $amount                // Legacy equivalents — NVP: AMT; SOAP: PaymentPeriod.Amount
            ]
        ]
    ];
    
    return updateSubscription($subscriptionId, $patchOperations);
}
```

**Update shipping amount**

```php
/**
 * Update subscription shipping amount
 * Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
 */
function updateShippingAmount($subscriptionId, $amount, $currencyCode = 'USD') 
{
    $patchOperations = [
        [
            'op' => 'replace',
            'path' => '/shipping_amount',
            'value' => [
                'currency_code' => $currencyCode,
                'value' => $amount  // Legacy equivalents — NVP: SHIPPINGAMT; SOAP: PaymentPeriod.ShippingAmount
            ]
        ]
    ];
    
    return updateSubscription($subscriptionId, $patchOperations);
}
```
