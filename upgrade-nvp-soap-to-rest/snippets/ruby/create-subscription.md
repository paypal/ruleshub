#### SNIPPET-CRPP-SETUP

**One-Time Setup (Run ONCE during upgrade)**

```ruby
# setup_subscription.rb
# Run: gem install httparty dotenv && ruby setup_subscription.rb

require 'httparty'
require 'json'
require 'dotenv/load'
require 'securerandom'
require 'fileutils'

BASE_URL = ENV['PAYPAL_MODE'] == 'live' ? 
  'https://api-m.paypal.com' : 
  'https://api-m.sandbox.paypal.com'

# Include get_paypal_access_token() from OAuth2 snippet

def setup_subscription_plan
  access_token = get_paypal_access_token
  
  headers = {
    'Authorization' => "Bearer #{access_token}",
    'PayPal-Request-Id' => SecureRandom.uuid,
    'Content-Type' => 'application/json'
  }
  
  # Step 1: Create Product
  product_data = {
    name: 'Premium Subscription',  # Legacy equivalents — NVP: DESC; SOAP: ProfileDetails.Description
    type: 'SERVICE'  # Legacy equivalents — NVP: L_PAYMENTREQUEST_0_ITEMCATEGORY0 (Digital→"DIGITAL", Physical→"PHYSICAL", default "SERVICE")
  }
  
  product_response = HTTParty.post(
    "#{BASE_URL}/v1/catalogs/products",
    body: product_data.to_json,
    headers: headers
  )
  
  raise "Failed to create product: #{product_response.body}" unless product_response.success?
  
  product_id = product_response.parsed_response['id']
  puts "Product created: #{product_id}"
  
  # Step 2: Create Plan
  # Build billing_cycles based on legacy code
  billing_cycles = []
  sequence = 1
  
  # Add TRIAL cycle ONLY if legacy has TRIALBILLINGPERIOD
  # Uncomment if legacy code has trial period:
  # billing_cycles << {
  #   tenure_type: 'TRIAL',
  #   sequence: sequence,
  #   total_cycles: 1,  # Legacy equivalents — NVP: TRIALTOTALBILLINGCYCLES
  #   frequency: {
  #     interval_unit: 'DAY',   # Legacy equivalents — NVP: TRIALBILLINGPERIOD
  #     interval_count: 7       # Legacy equivalents — NVP: TRIALBILLINGFREQUENCY
  #   }
  #   # Omit pricing_scheme for free trial (TRIALAMT = 0)
  # }
  # sequence += 1
  
  # Add REGULAR cycle (always present)
  billing_cycles << {
    tenure_type: 'REGULAR',
    sequence: sequence,
    total_cycles: 0,  # Legacy equivalents — NVP: TOTALBILLINGCYCLES (0 = unlimited)
    frequency: {
      interval_unit: 'MONTH',  # Legacy equivalents — NVP: BILLINGPERIOD
      interval_count: 1        # Legacy equivalents — NVP: BILLINGFREQUENCY
    },
    pricing_scheme: {
      fixed_price: {
        value: '29.99',       # Legacy equivalents — NVP: AMT
        currency_code: 'USD'  # Legacy equivalents — NVP: CURRENCYCODE
      }
    }
  }
  
  # Build payment_preferences
  payment_preferences = {
    auto_bill_outstanding: true,   # Legacy equivalents — NVP: AUTOBILLOUTAMT
    payment_failure_threshold: 3   # Legacy equivalents — NVP: MAXFAILEDPAYMENTS
  }
  
  # Include setup_fee for:
  # - FLOW 1 (Subscription Only): if INITAMT > 0
  # - FLOW 2 (Subscription + One-Time): map PAYMENTREQUEST_0_AMT
  # Uncomment if legacy has initial/one-time amount:
  # payment_preferences[:setup_fee] = {
  #   value: '49.99',       # Legacy equivalents — NVP: INITAMT or PAYMENTREQUEST_0_AMT
  #   currency_code: 'USD'
  # }
  
  plan_data = {
    product_id: product_id,
    name: 'Monthly Premium Plan',  # Legacy equivalents — NVP: DESC
    billing_cycles: billing_cycles,
    payment_preferences: payment_preferences
  }
  
  headers['PayPal-Request-Id'] = SecureRandom.uuid
  
  plan_response = HTTParty.post(
    "#{BASE_URL}/v1/billing/plans",
    body: plan_data.to_json,
    headers: headers
  )
  
  raise "Failed to create plan: #{plan_response.body}" unless plan_response.success?
  
  plan_id = plan_response.parsed_response['id']
  
  # Save to config file
  FileUtils.mkdir_p('./config')
  config = { product_id: product_id, plan_id: plan_id }
  File.write('./config/paypal-subscriptions.json', JSON.pretty_generate(config))
  
  puts "Setup complete! Product: #{product_id}, Plan: #{plan_id}"
  config
end

begin
  setup_subscription_plan
rescue => e
  puts "Setup failed: #{e.message}"
  puts e.backtrace.first(5).join("\n")
  exit 1
end
```

#### SNIPPET-CRPP-RUNTIME

**Per-Customer Flow (Each Customer Subscription)**

```ruby
# subscription_service.rb

require 'httparty'
require 'json'
require 'dotenv/load'
require 'securerandom'

class SubscriptionService
  BASE_URL = ENV['PAYPAL_MODE'] == 'live' ? 
    'https://api-m.paypal.com' : 
    'https://api-m.sandbox.paypal.com'
  
  def initialize
    # Load config from One-Time Setup
    # Uses project root to find config - works even if this file is in a subfolder like lib/services/
    config_path = find_config_path
    raise "Config not found at #{config_path}. Run setup_subscription.rb first, or set PAYPAL_CONFIG_PATH env var." unless File.exist?(config_path)
    
    config = JSON.parse(File.read(config_path))
    @plan_id = config['plan_id']
  end
  
  private
  
  def find_config_path
    return ENV['PAYPAL_CONFIG_PATH'] if ENV['PAYPAL_CONFIG_PATH']
    
    # Walk up from this file to find config directory
    dir = File.dirname(File.expand_path(__FILE__))
    while dir != File.dirname(dir)
      path = File.join(dir, 'config', 'paypal-subscriptions.json')
      return path if File.exist?(path)
      dir = File.dirname(dir)
    end
    # Fallback to relative path
    './config/paypal-subscriptions.json'
  end
  
  public
  
  # Include get_paypal_access_token() from OAuth2 snippet
  
  # RUNTIME FLOW:
  # 1. User clicks Subscribe → create_subscription() → redirect to PayPal
  # 2. User approves on PayPal → PayPal redirects to return_url
  # 3. Return handler → check status → activate_subscription()
  
  # Create subscription and get approval URL.
  # @param return_url [String] Where PayPal redirects after approval (Legacy: NVP RETURNURL)
  # @param cancel_url [String] Where PayPal redirects if cancelled (Legacy: NVP CANCELURL)
  # @param custom_id [String, nil] Your reference ID (Legacy: NVP PROFILEREFERENCE)
  # @param start_time [String, nil] ISO 8601 start date (Legacy: NVP PROFILESTARTDATE)
  def create_subscription(return_url, cancel_url, custom_id: nil, start_time: nil)
    access_token = get_paypal_access_token
    
    subscription_data = {
      plan_id: @plan_id,  # From config - NOT created per customer
      application_context: {
        user_action: 'CONTINUE',        # CRITICAL: Requires explicit activation after approval
        return_url: return_url,
        cancel_url: cancel_url,
        brand_name: 'Your Company',     # Legacy equivalents — NVP: BRANDNAME
        shipping_preference: 'NO_SHIPPING'  # Legacy equivalents — NVP: NOSHIPPING
      }
    }
    
    subscription_data[:custom_id] = custom_id if custom_id
    subscription_data[:start_time] = start_time if start_time
    
    response = HTTParty.post(
      "#{BASE_URL}/v1/billing/subscriptions",
      body: subscription_data.to_json,
      headers: {
        'Authorization' => "Bearer #{access_token}",
        'PayPal-Request-Id' => SecureRandom.uuid,
        'Content-Type' => 'application/json'
      }
    )
    
    raise "Failed to create subscription: #{response.body}" unless response.success?
    
    result = response.parsed_response
    approval_url = result['links']&.find { |link| link['rel'] == 'approve' }&.dig('href')
    
    { subscription_id: result['id'], approval_url: approval_url }
  end
  
  # Get subscription status and details.
  def get_subscription_details(subscription_id)
    access_token = get_paypal_access_token
    
    response = HTTParty.get(
      "#{BASE_URL}/v1/billing/subscriptions/#{subscription_id}",
      headers: { 'Authorization' => "Bearer #{access_token}" }
    )
    
    raise "Failed to get subscription: #{response.body}" unless response.success?
    
    response.parsed_response
  end
  
  # Activate subscription after user approval.
  # CRITICAL: Only call when status is 'APPROVED' (not 'APPROVAL_PENDING').
  # Status flow: APPROVAL_PENDING → (user approves) → APPROVED → (activate) → ACTIVE
  def activate_subscription(subscription_id)
    access_token = get_paypal_access_token
    
    response = HTTParty.post(
      "#{BASE_URL}/v1/billing/subscriptions/#{subscription_id}/activate",
      body: { reason: 'Customer approved subscription' }.to_json,
      headers: {
        'Authorization' => "Bearer #{access_token}",
        'PayPal-Request-Id' => SecureRandom.uuid,
        'Content-Type' => 'application/json'
      }
    )
    
    raise "Failed to activate subscription: #{response.body}" unless response.success?
  end
  
  # Handle return from PayPal approval page.
  # Call this in your return_url route handler.
  def handle_subscription_return(subscription_id)
    details = get_subscription_details(subscription_id)
    status = details['status']
    
    case status
    when 'APPROVED'
      activate_subscription(subscription_id)
      { success: true, status: 'ACTIVE' }
    when 'ACTIVE'
      { success: true, status: 'ACTIVE', message: 'Already activated' }
    else
      { success: false, status: status, message: "Unexpected status: #{status}" }
    end
  end
end
```

#### SNIPPET-CRPP-TRIAL-EXAMPLE

**Example: Plan with 7-day free trial then $29.99/month**

```ruby
# Legacy: TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
#         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
billing_cycles = [
  {
    tenure_type: 'TRIAL',
    sequence: 1,
    total_cycles: 1,
    frequency: { interval_unit: 'DAY', interval_count: 7 }
    # No pricing_scheme = free trial (TRIALAMT = 0)
  },
  {
    tenure_type: 'REGULAR',
    sequence: 2,
    total_cycles: 0,
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    pricing_scheme: {
      fixed_price: { value: '29.99', currency_code: 'USD' }
    }
  }
]
```

#### SNIPPET-CRPP-SETUP-FEE-EXAMPLE

**Example: $49.99 setup fee + $29.99/month recurring**

```ruby
# Legacy FLOW 1: INITAMT=49.99 → setup_fee
# Legacy FLOW 2: PAYMENTREQUEST_0_AMT=49.99 → setup_fee
payment_preferences = {
  auto_bill_outstanding: true,
  payment_failure_threshold: 3,
  setup_fee: {
    value: '49.99',       # Legacy: NVP INITAMT or PAYMENTREQUEST_0_AMT
    currency_code: 'USD'
  }
}

billing_cycles = [{
  tenure_type: 'REGULAR',
  sequence: 1,
  total_cycles: 0,
  frequency: { interval_unit: 'MONTH', interval_count: 1 },
  pricing_scheme: {
    fixed_price: { value: '29.99', currency_code: 'USD' }  # Legacy: NVP AMT
  }
}]
```

#### SNIPPET-CRPP-TRIAL-SETUPFEE-EXAMPLE

**Example: $49.99 setup fee + 7-day free trial + $29.99/month recurring**

```ruby
# Legacy: INITAMT=49.99, TRIALBILLINGPERIOD=Day, TRIALBILLINGFREQUENCY=7, TRIALAMT=0, TRIALTOTALBILLINGCYCLES=1
#         BILLINGPERIOD=Month, BILLINGFREQUENCY=1, AMT=29.99, TOTALBILLINGCYCLES=0
# Charge sequence: setup_fee at activation → trial period → regular billing

billing_cycles = [
  {
    tenure_type: 'TRIAL',
    sequence: 1,
    total_cycles: 1,
    frequency: { interval_unit: 'DAY', interval_count: 7 }
    # No pricing_scheme = free trial (TRIALAMT = 0)
  },
  {
    tenure_type: 'REGULAR',
    sequence: 2,
    total_cycles: 0,
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    pricing_scheme: {
      fixed_price: { value: '29.99', currency_code: 'USD' }  # Legacy: NVP AMT
    }
  }
]

payment_preferences = {
  auto_bill_outstanding: true,
  payment_failure_threshold: 3,
  setup_fee: {
    value: '49.99',       # Legacy: NVP INITAMT - charged at activation, BEFORE trial starts
    currency_code: 'USD'
  }
}
```
