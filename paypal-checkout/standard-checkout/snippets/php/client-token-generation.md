# Client Token Generation (Browser-Safe) — JS SDK v6

For **JavaScript SDK v6**, the browser should receive a **browser-safe client token** from your server. Never expose `PAYPAL_CLIENT_SECRET` in frontend code.

## PayPal OAuth endpoint

**POST** `https://api-m.sandbox.paypal.com/v1/oauth2/token` (sandbox)  
**POST** `https://api-m.paypal.com/v1/oauth2/token` (production)

Body (form URL-encoded):

```
grant_type=client_credentials&response_type=client_token&intent=sdk_init
```

**Authorization:** `Basic` with Base64 of `client_id:client_secret`.

## Vanilla PHP — GET `/paypal-api/auth/browser-safe-client-token`

Token response includes `access_token` and `expires_in`. Cache in memory, a file, or PHP session to avoid hitting OAuth on every page load.

### File-based cache (single-server)

```php
<?php
declare(strict_types=1);

/**
 * Returns PayPal browser-safe client token JSON for the frontend.
 * Route: GET /paypal-api/auth/browser-safe-client-token
 */
function paypal_base_url(): string
{
    $env = $_ENV['PAYPAL_ENVIRONMENT'] ?? getenv('PAYPAL_ENVIRONMENT') ?: 'sandbox';
    return $env === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
}

function paypal_client_credentials(): array
{
    $id = $_ENV['PAYPAL_CLIENT_ID'] ?? getenv('PAYPAL_CLIENT_ID') ?: '';
    $secret = $_ENV['PAYPAL_CLIENT_SECRET'] ?? getenv('PAYPAL_CLIENT_SECRET') ?: '';
    if ($id === '' || $secret === '') {
        throw new RuntimeException('PayPal credentials are not configured.');
    }
    return [$id, $secret];
}

function fetch_paypal_client_token_cached(string $cacheFile, int $bufferSeconds = 120): array
{
    if (is_readable($cacheFile)) {
        $raw = file_get_contents($cacheFile);
        if ($raw !== false) {
            $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (isset($data['token'], $data['expires_at']) && time() < (int) $data['expires_at']) {
                return [
                    'accessToken' => $data['token'],
                    'expiresIn' => (int) $data['expires_at'] - time(),
                ];
            }
        }
    }

    [$clientId, $secret] = paypal_client_credentials();
    $base = paypal_base_url();
    $url = $base . '/v1/oauth2/token';
    $body = 'grant_type=client_credentials&response_type=client_token&intent=sdk_init';
    $auth = base64_encode($clientId . ':' . $secret);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => [
            'Authorization: Basic ' . $auth,
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);
    $responseBody = curl_exec($ch);
    $errno = curl_errno($ch);
    $errstr = curl_error($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($errno !== 0 || !is_string($responseBody)) {
        throw new RuntimeException('cURL error fetching client token: ' . $errstr);
    }
    if ($http < 200 || $http >= 300) {
        throw new RuntimeException('PayPal OAuth failed: HTTP ' . $http . ' ' . $responseBody);
    }

    $decoded = json_decode($responseBody, true, 512, JSON_THROW_ON_ERROR);
    $token = $decoded['access_token'] ?? '';
    $expiresIn = (int) ($decoded['expires_in'] ?? 0);
    if ($token === '' || $expiresIn <= 0) {
        throw new RuntimeException('Unexpected OAuth response shape.');
    }

    $expiresAt = time() + max(0, $expiresIn - $bufferSeconds);
    file_put_contents(
        $cacheFile,
        json_encode(['token' => $token, 'expires_at' => $expiresAt], JSON_THROW_ON_ERROR),
        LOCK_EX
    );

    return ['accessToken' => $token, 'expiresIn' => $expiresIn];
}

// Example front controller fragment
header('Content-Type: application/json; charset=utf-8');
try {
    $out = fetch_paypal_client_token_cached(sys_get_temp_dir() . '/paypal_client_token.json');
    echo json_encode($out, JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()], JSON_THROW_ON_ERROR);
}
```

### Session-based cache (per user)

```php
<?php
declare(strict_types=1);

session_start();

function get_cached_or_fetch_client_token(): array
{
    $now = time();
    if (
        isset($_SESSION['paypal_client_token'], $_SESSION['paypal_client_token_expires'])
        && $now < (int) $_SESSION['paypal_client_token_expires']
    ) {
        return [
            'accessToken' => $_SESSION['paypal_client_token'],
            'expiresIn' => (int) $_SESSION['paypal_client_token_expires'] - $now,
        ];
    }

    // Reuse the same cURL POST to /v1/oauth2/token as in fetch_paypal_client_token_cached(),
    // then assign:
    // $_SESSION['paypal_client_token'] = $token;
    // $_SESSION['paypal_client_token_expires'] = time() + $expiresIn - 120;
    throw new RuntimeException('Implement fetch and assign session keys.');
}
```

## Optional: Laravel route

```php
<?php
// routes/web.php or routes/api.php
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::get('/paypal-api/auth/browser-safe-client-token', function () {
    $base = config('services.paypal.environment') === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    return Cache::remember('paypal_client_token', now()->addMinutes(50), function () use ($base) {
        $id = config('services.paypal.client_id');
        $secret = config('services.paypal.secret');
        $response = Http::asForm()
            ->withBasicAuth($id, $secret)
            ->post($base . '/v1/oauth2/token', [
                'grant_type' => 'client_credentials',
                'response_type' => 'client_token',
                'intent' => 'sdk_init',
            ]);
        $response->throw();
        $data = $response->json();
        return response()->json([
            'accessToken' => $data['access_token'],
            'expiresIn' => $data['expires_in'],
        ]);
    });
});
```

Return the JSON your JS SDK expects (`accessToken` / `expiresIn` or the field names your frontend uses consistently).
