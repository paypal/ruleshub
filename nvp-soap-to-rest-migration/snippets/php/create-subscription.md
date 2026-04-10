#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```php
<?php
// setup-subscription.php
// Run: composer require guzzlehttp/guzzle vlucas/phpdotenv && php setup-subscription.php

require_once 'vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

$baseUrl = $_ENV['PAYPAL_MODE'] === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

$client = new Client(['base_uri' => $baseUrl]);

// Include getPayPalAccessToken() from OAuth2 snippet

function setupSubscriptionPlan() {
    global $client, $baseUrl;
    
    $accessToken = getPayPalAccessToken();
    
    try {
        // Step 1: Create Product
        $productData = [
            'name' => 'Premium Subscription',  // Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
            'type' => 'SERVICE'  // Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
        ];
        
        $productResponse = $client->post('/v1/catalogs/products', [
            'headers' => [
                'Authorization' => "Bearer $accessToken",
                'PayPal-Request-Id' => vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
                'Content-Type' => 'application/json'
            ],
            'json' => $productData
        ]);
        
        $productResult = json_decode($productResponse->getBody(), true);
        $productId = $productResult['id'];
        echo "Product created: $productId\n";
        
        // Step 2: Create Plan
        // Build billing_cycles based on legacy code
        $billingCycles = [];
        $sequence = 1;
        
        // Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
        // Uncomment if legacy code has trial period:
        // $billingCycles[] = [
        //     'tenure_type' => 'TRIAL',
        //     'sequence' => $sequence++,
        //     'total_cycles' => 1,  // Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES
        //     'frequency' => [
        //         'interval_unit' => 'DAY',   // Legacy equivalents — NVP: TRIALBILLINGPERIOD
        //         'interval_count' => 7       // Legacy equivalents — NVP: TRIALBILLINGFREQUENCY
        //     ]
        //     // Omit pricing_scheme for free trial (TRIALAMT = 0)
        // ];
        
        // Add REGULAR cycle (always present)
        $billingCycles[] = [
            'tenure_type' => 'REGULAR',
            'sequence' => $sequence,
            'total_cycles' => 0,  // Legacy equivalents — NVP: TOTALBILLINGCYCLES (0 = unlimited)
            'frequency' => [
                'interval_unit' => 'MONTH',  // Legacy equivalents — NVP: BILLINGPERIOD
                'interval_count' => 1        // Legacy equivalents — NVP: BILLINGFREQUENCY
            ],
            'pricing_scheme' => [
                'fixed_price' => [
                    'value' => '29.99',       // Legacy equivalents — NVP: AMT
                    'currency_code' => 'USD'  // Legacy equivalents — NVP: CURRENCYCODE
                ]
            ]
        ];
        
        // Build payment_preferences
        $paymentPreferences = [
            'auto_bill_outstanding' => true,   // Legacy equivalents — NVP: AUTOBILLOUTAMT
            'payment_failure_threshold' => 3   // Legacy equivalents — NVP: MAXFAILEDPAYMENTS
        ];
        
        // Include setup_fee for:
        // - FLOW 1 (Subscription Only): if INITAMT > 0
        // - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
        // Uncomment if legacy has initial/one-time amount:
        // $paymentPreferences['setup_fee'] = [
        //     'value' => '49.99',       // Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT
        //     'currency_code' => 'USD'
        // ];
        
        $planData = [
            'product_id' => $productId,
            'name' => 'Monthly Premium Plan',  // Legacy equivalents — NVP: DESC
            'billing_cycles' => $billingCycles,
            'payment_preferences' => $paymentPreferences
        ];
        
        $planResponse = $client->post('/v1/billing/plans', [
            'headers' => [
                'Authorization' => "Bearer $accessToken",
                'PayPal-Request-Id' => vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
                'Content-Type' => 'application/json'
            ],
            'json' => $planData
        ]);
        
        $planResult = json_decode($planResponse->getBody(), true);
        $planId = $planResult['id'];
        
        // Save to config file
        if (!is_dir('./config')) {
            mkdir('./config', 0755, true);
        }
        
        $config = [
            'product_id' => $productId,
            'plan_id' => $planId
        ];
        file_put_contents('./config/paypal-subscriptions.json', json_encode($config, JSON_PRETTY_PRINT));
        
        echo "Setup complete! Product: $productId, Plan: $planId\n";
        return $config;
        
    } catch (RequestException $e) {
        $errorBody = $e->hasResponse() ? json_decode($e->getResponse()->getBody(), true) : $e->getMessage();
        echo "Setup failed: " . print_r($errorBody, true) . "\n";
        if (isset($errorBody['debug_id'])) {
            echo "Debug ID: " . $errorBody['debug_id'] . "\n";
        }
        exit(1);
    }
}

setupSubscriptionPlan();
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Each Customer Subscription)**

```php
<?php
// SubscriptionService.php

require_once 'vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Dotenv\Dotenv;

class SubscriptionService {
    
    private $client;
    private $baseUrl;
    private $planId;
    
    public function __construct() {
        $dotenv = Dotenv::createImmutable(__DIR__);
        $dotenv->load();
        
        $this->baseUrl = $_ENV['PAYPAL_MODE'] === 'live' 
            ? 'https://api-m.paypal.com' 
            : 'https://api-m.sandbox.paypal.com';
        
        $this->client = new Client(['base_uri' => $this->baseUrl]);
        
        // Load config from One-Time Setup
        // Uses project root to find config - works even if this file is in a subfolder like src/Services/
        $configPath = $_ENV['PAYPAL_CONFIG_PATH'] ?? $this->findConfigPath();
        if (!file_exists($configPath)) {
            throw new Exception("Config not found at {$configPath}. Run setup-subscription.php first, or set PAYPAL_CONFIG_PATH env var.");
        }
        
        $config = json_decode(file_get_contents($configPath), true);
        $this->planId = $config['plan_id'];
    }
    
    private function findConfigPath(): string {
        // Walk up from this file to find config directory
        $dir = __DIR__;
        while ($dir !== dirname($dir)) {
            $path = $dir . '/config/paypal-subscriptions.json';
            if (file_exists($path)) {
                return $path;
            }
            $dir = dirname($dir);
        }
        // Fallback to relative path
        return './config/paypal-subscriptions.json';
    }
    
    // Include getPayPalAccessToken() from OAuth2 snippet
    
    // RUNTIME FLOW:
    // 1. User clicks Subscribe → createSubscription() → redirect to PayPal
    // 2. User approves on PayPal → PayPal redirects to return_url
    // 3. Return handler → check status → activateSubscription()
    
    /**
     * Create subscription and get approval URL.
     * @param string $returnUrl Where PayPal redirects after approval (Legacy: NVP RETURNURL)
     * @param string $cancelUrl Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)
     * @param string|null $customId Your reference ID (Legacy: NVP PROFILEREFERENCE)
     * @param string|null $startTime ISO 8601 start date (Legacy: NVP PROFILESTARTDATE)
     */
    public function createSubscription($returnUrl, $cancelUrl, $customId = null, $startTime = null) {
        $accessToken = $this->getPayPalAccessToken();
        
        $subscriptionData = [
            'plan_id' => $this->planId,  // From config - NOT created per customer
            'application_context' => [
                'user_action' => 'CONTINUE',        // CRITICAL: Requires explicit activation after approval
                'return_url' => $returnUrl,
                'cancel_url' => $cancelUrl,
                'brand_name' => 'Your Company',     // Legacy equivalents — NVP: BRANDNAME
                'shipping_preference' => 'NO_SHIPPING'  // Legacy equivalents — NVP: NOSHIPPING
            ]
        ];
        
        if ($customId) {
            $subscriptionData['custom_id'] = $customId;
        }
        
        if ($startTime) {
            $subscriptionData['start_time'] = $startTime;
        }
        
        $response = $this->client->post('/v1/billing/subscriptions', [
            'headers' => [
                'Authorization' => "Bearer $accessToken",
                'PayPal-Request-Id' => vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
                'Content-Type' => 'application/json'
            ],
            'json' => $subscriptionData
        ]);
        
        $result = json_decode($response->getBody(), true);
        
        $approvalUrl = null;
        foreach ($result['links'] as $link) {
            if ($link['rel'] === 'approve') {
                $approvalUrl = $link['href'];
                break;
            }
        }
        
        return [
            'subscription_id' => $result['id'],
            'approval_url' => $approvalUrl
        ];
    }
    
    /**
     * Get subscription status and details.
     */
    public function getSubscriptionDetails($subscriptionId) {
        $accessToken = $this->getPayPalAccessToken();
        
        $response = $this->client->get("/v1/billing/subscriptions/$subscriptionId", [
            'headers' => [
                'Authorization' => "Bearer $accessToken"
            ]
        ]);
        
        return json_decode($response->getBody(), true);
    }
    
    /**
     * Activate subscription after user approval.
     * CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
     * Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
     */
    public function activateSubscription($subscriptionId) {
        $accessToken = $this->getPayPalAccessToken();
        
        $this->client->post("/v1/billing/subscriptions/$subscriptionId/activate", [
            'headers' => [
                'Authorization' => "Bearer $accessToken",
                'PayPal-Request-Id' => vsprintf('%s%s-%s-4000-8000-%s%s%s', str_split(bin2hex(random_bytes(16)), 4)),
                'Content-Type' => 'application/json'
            ],
            'json' => [
                'reason' => 'Customer approved subscription'
            ]
        ]);
    }
    
    /**
     * Handle return from PayPal approval page.
     * Call this in your return_url route handler.
     */
    public function handleSubscriptionReturn($subscriptionId) {
        $details = $this->getSubscriptionDetails($subscriptionId);
        $status = $details['status'];
        
        if ($status === 'APPROVED') {
            $this->activateSubscription($subscriptionId);
            return ['success' => true, 'status' => 'ACTIVE'];
        } elseif ($status === 'ACTIVE') {
            return ['success' => true, 'status' => 'ACTIVE', 'message' => 'Already activated'];
        } else {
            return ['success' => false, 'status' => $status, 'message' => "Unexpected status: $status"];
        }
    }
}
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```php
// Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
$billingCycles = [
    [
        'tenure_type' => 'TRIAL',
        'sequence' => 1,
        'total_cycles' => 1,
        'frequency' => ['interval_unit' => 'DAY', 'interval_count' => 7]
        // No pricing_scheme = free trial (TRIALAMT = 0)
    ],
    [
        'tenure_type' => 'REGULAR',
        'sequence' => 2,
        'total_cycles' => 0,
        'frequency' => ['interval_unit' => 'MONTH', 'interval_count' => 1],
        'pricing_scheme' => [
            'fixed_price' => ['value' => '29.99', 'currency_code' => 'USD']
        ]
    ]
];
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```php
// Legacy FLOW 1: INITAMT=49.99 → setup_fee
// Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
$paymentPreferences = [
    'auto_bill_outstanding' => true,
    'payment_failure_threshold' => 3,
    'setup_fee' => [
        'value' => '49.99',       // Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
        'currency_code' => 'USD'
    ]
];

$billingCycles = [[
    'tenure_type' => 'REGULAR',
    'sequence' => 1,
    'total_cycles' => 0,
    'frequency' => ['interval_unit' => 'MONTH', 'interval_count' => 1],
    'pricing_scheme' => [
        'fixed_price' => ['value' => '29.99', 'currency_code' => 'USD']  // Legacy: NVP AMT
    ]
]];
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```php
// Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
//         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
// Charge sequence: setup_fee at activation → trial period → regular billing

$billingCycles = [
    [
        'tenure_type' => 'TRIAL',
        'sequence' => 1,
        'total_cycles' => 1,
        'frequency' => ['interval_unit' => 'DAY', 'interval_count' => 7]
        // No pricing_scheme = free trial (TRIALAMT = 0)
    ],
    [
        'tenure_type' => 'REGULAR',
        'sequence' => 2,
        'total_cycles' => 0,
        'frequency' => ['interval_unit' => 'MONTH', 'interval_count' => 1],
        'pricing_scheme' => [
            'fixed_price' => ['value' => '29.99', 'currency_code' => 'USD']  // Legacy: NVP AMT
        ]
    ]
];

$paymentPreferences = [
    'auto_bill_outstanding' => true,
    'payment_failure_threshold' => 3,
    'setup_fee' => [
        'value' => '49.99',       // Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
        'currency_code' => 'USD'
    ]
];
```
