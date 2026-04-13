#### Finding Transactions with TransactionID (legacy `GetTransactionDetails`)

```php
function viewTransaction($transactionId) {
    try {
        $accessToken = getPayPalAccessToken();
        $now = new DateTime();
        $endTime = new DateTime();
        $endTime->sub(new DateInterval('P1D')); 
        $startTime = new DateTime();
        $startTime->sub(new DateInterval('P7D'));
        $params = http_build_query([
            'start_date' => $startTime->format(DateTime::ATOM), // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
            'end_date' => $endTime->format(DateTime::ATOM), // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
            'transaction_id' => $transactionId // Legacy equivalents — NVP: TRANSACTIONID ; SOAP: TransactionID
        ]);
        global $paypalHostname;
        $url = "{$paypalHostname}/v1/reporting/transactions?{$params}";
        $headers = [
            'Authorization: Bearer ' . $accessToken,
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to view transaction');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to view transaction');
        }
        return $responseData;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```

#### Searching Transactions between a start date and end date (legacy `TransactionSearch`)

```php
function transactionSearch() {
    try {
        $accessToken = getPayPalAccessToken();
        $now = new DateTime();
        $endTime = new DateTime();
        $endTime->sub(new DateInterval('P1D')); 
        $startTime = new DateTime();
        $startTime->sub(new DateInterval('P7D'));
        $params = http_build_query([
            'start_date' => $startTime->format(DateTime::ATOM), // Legacy equivalents — NVP: STARTDATE ; SOAP: StartDate
            'end_date' => $endTime->format(DateTime::ATOM) // Legacy equivalents — NVP: ENDDATE ; SOAP: EndDate
        ]);
        global $paypalHostname;
        $url = "{$paypalHostname}/v1/reporting/transactions?{$params}";
        $headers = [
            'Authorization: Bearer ' . $accessToken,
        ];
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            error_log('Curl error: ' . curl_error($ch));
            curl_close($ch);
            throw new Exception('Failed to perform transaction search');
        }
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $responseData = json_decode($response, true);
        if ($httpCode >= 300) {
            error_log('Error debug id: ' . ($responseData['debug_id'] ?? 'N/A'));
            throw new Exception('Failed to perform transaction search');
        }
        return $responseData;
    } catch (Exception $e) {
        error_log($e->getMessage());
        throw $e;
    }
}
```