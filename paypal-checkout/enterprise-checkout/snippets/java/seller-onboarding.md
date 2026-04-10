# Seller onboarding — `HttpClient` POST partner-referrals, check status

Create a seller onboarding link with **`POST /v2/customer/partner-referrals`**. After the seller completes PayPal, check status with **`GET /v1/customer/partners/{partner_id}/merchant-integrations/{merchant_id}`**.

Base URLs:

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

Use **`java.net.http.HttpClient`** for all PayPal multiparty REST calls (OAuth, referrals, status).

## OAuth client credentials

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

public class PayPalOAuthClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private final String baseUrl;
  private final String clientId;
  private final String clientSecret;

  public PayPalOAuthClient(String paypalEnvironment, String clientId, String clientSecret) {
    this.baseUrl =
        "production".equalsIgnoreCase(paypalEnvironment)
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  public String getAccessToken() throws Exception {
    String auth =
        Base64.getEncoder()
            .encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

    String form =
        URLEncoder.encode("grant_type", StandardCharsets.UTF_8)
            + "="
            + URLEncoder.encode("client_credentials", StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v1/oauth2/token"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Basic " + auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("OAuth failed: " + response.statusCode() + " " + response.body());
    }

    JsonNode root = MAPPER.readTree(response.body());
    return root.get("access_token").asText();
  }
}
```

## POST `/v2/customer/partner-referrals`

```java
  public String createPartnerReferral(String accessToken, String trackingId, String returnUrl)
      throws Exception {

    String body =
        """
        {
          "tracking_id": "%s",
          "partner_config_override": { "return_url": "%s" },
          "operations": [
            {
              "operation": "API_INTEGRATION",
              "api_integration_preference": {
                "rest_api_integration": {
                  "integration_method": "PAYPAL",
                  "integration_type": "THIRD_PARTY",
                  "third_party_details": {
                    "features": ["PAYMENT", "REFUND", "PARTNER_FEE"]
                  }
                }
              }
            }
          ],
          "products": ["EXPRESS_CHECKOUT"],
          "legal_consents": [{ "type": "SHARE_DATA_CONSENT", "granted": true }]
        }
        """
            .formatted(trackingId, returnUrl);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/v2/customer/partner-referrals"))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("partner-referrals failed: " + response.body());
    }

    return response.body();
  }
```

Resolve the seller **`action_url`** from **`links`** (`rel`: **`action_url`**) and redirect the seller there (parse JSON with Jackson).

## Check onboarding status

```java
  public String merchantIntegrationStatus(String accessToken, String partnerId, String merchantId)
      throws Exception {

    String path =
        "/v1/customer/partners/"
            + URLEncoder.encode(partnerId, StandardCharsets.UTF_8)
            + "/merchant-integrations/"
            + URLEncoder.encode(merchantId, StandardCharsets.UTF_8);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + path))
            .timeout(Duration.ofSeconds(30))
            .header("Authorization", "Bearer " + accessToken)
            .GET()
            .build();

    HttpResponse<String> response =
        http.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() / 100 != 2) {
      throw new IllegalStateException("merchant-integrations failed: " + response.body());
    }

    return response.body();
  }
```

Key fields typically include **`payments_receivable`**, **`primary_email_confirmed`**, and **`oauth_integrations`**. Only route live payments after your checks pass.

## Notes

- Use a unique **`tracking_id`** per seller attempt for correlation.
- Store **`merchant_id`** (seller) securely after onboarding for **`PayPal-Auth-Assertion`** on orders (`multiparty-create-order.md`).
