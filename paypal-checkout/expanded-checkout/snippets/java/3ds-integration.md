# 3D Secure — PayPal Expanded Checkout (concepts + server alignment)

3D Secure (3DS) is driven by **`payment_source.card.attributes.verification.method`** at **order creation** and by **`payment_source.card.experience_context`** (return/cancel URLs). Expanded Checkout typically uses **`SCA_WHEN_REQUIRED`** so authentication runs when the issuer or regulations require it.

**REST bases:** Sandbox `https://api-m.sandbox.paypal.com`, Production `https://api-m.paypal.com`.

## Verification methods

| Method | When to use |
|--------|-------------|
| `SCA_WHEN_REQUIRED` | **Recommended** — challenge only when required (PSD2/SCA, issuer rules). |
| `SCA_ALWAYS` | Always request SCA / 3DS (stricter UX; use when policy requires). |

Set under **`payment_source.card.attributes.verification`** in the create-order body (see `create-order.md`).

## `experience_context` for 3DS

Include **`return_url`** and **`cancel_url`** inside **`payment_source.card.experience_context`**. The SDK uses these when a payer must complete a challenge or redirect.

Do **not** use deprecated top-level **`application_context`** — use **`payment_source.paypal.experience_context`** for PayPal wallet flows and **`payment_source.card.experience_context`** for cards.

## `authentication_result` after capture

After successful capture, read **`payment_source.card.authentication_result`** (and nested **`three_d_secure`** where returned) from the capture response.

```java
import com.fasterxml.jackson.databind.JsonNode;

public final class ThreeDSecureCaptureReader {

  private ThreeDSecureCaptureReader() {}

  public static JsonNode authenticationResult(JsonNode captureResponse) {
    return captureResponse.path("payment_source").path("card").path("authentication_result");
  }

  public static String threeDSStatus(JsonNode captureResponse) {
    return authenticationResult(captureResponse)
        .path("three_d_secure")
        .path("authentication_status")
        .asText(null);
  }
}
```

Exact nested names follow the live Orders v2 schema — validate against sandbox responses.

## Business logic guidelines

1. **Fulfillment:** If capture returns `COMPLETED` and amount matches, fulfill per your policy; use **`authentication_result`** for risk and chargeback prep.
2. **Challenges:** Complete payer action before capture; do not capture until the order is approvable.
3. **Failures:** Map errors using `error-handling.md`; never log raw card data.

## PayPal wallet vs card

- **Card:** `payment_source.card` + verification + `experience_context`.
- **PayPal:** `payment_source.paypal.experience_context` (not root `application_context`).
