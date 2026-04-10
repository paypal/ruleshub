# Prerequisites — PayPal Enterprise Checkout (Spring Boot 3 / Java)

Enterprise Checkout combines **Braintree Direct** (`braintree-java`) for cards, vault, fraud tools, Drop-in UI, and Hosted Fields with **Multiparty / Platform** flows via **PayPal REST** (`java.net.http.HttpClient`). **Agentic Commerce / Store Sync** adds Cart operations and AI-driven checkout. Use this checklist before you integrate.

## Runtime

- **Java 17+** (LTS recommended; Spring Boot 3 targets Java 17 as a baseline).
- **Spring Boot 3.x** — `spring-boot-starter-web`, Thymeleaf optional for server-rendered checkout pages, Jackson for JSON.

## Build tool dependencies

### Maven (`pom.xml`)

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>3.2.5</version>
  <relativePath/>
</parent>

<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-thymeleaf</artifactId>
  </dependency>
  <dependency>
    <groupId>com.braintreepayments.gateway</groupId>
    <artifactId>braintree-java</artifactId>
    <version>3.29.0</version>
  </dependency>
</dependencies>
```

`java.net.http.HttpClient` ships with the JDK — use it for PayPal REST (OAuth, partner referrals, Orders v2, captures, refunds, webhook verification).

### Gradle (`build.gradle.kts`)

```kotlin
plugins {
  java
  id("org.springframework.boot") version "3.2.5"
  id("io.spring.dependency-management") version "1.1.4"
}

dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
  implementation("org.springframework.boot:spring-boot-starter-validation")
  implementation("org.springframework.boot:spring-boot-starter-thymeleaf")
  implementation("com.braintreepayments.gateway:braintree-java:3.29.0")
}
```

Pin `braintree-java` to the latest compatible release from [Maven Central](https://central.sonatype.com/artifact/com.braintreepayments.gateway/braintree-java).

## Environment variables

Never commit secrets. Use environment variables, Spring `application.yml` with externalized secrets, or a secrets manager.

### Braintree (`BraintreeGateway`)

| Variable | Description |
|----------|-------------|
| `BRAINTREE_MERCHANT_ID` | Merchant ID from the Braintree Control Panel |
| `BRAINTREE_PUBLIC_KEY` | Public key |
| `BRAINTREE_PRIVATE_KEY` | Private key — **server only** |
| `BRAINTREE_ENVIRONMENT` | `Sandbox` or `Production` (maps to `com.braintreegateway.Environment`) |

### PayPal REST (multiparty, Cart-related REST, webhooks)

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` (selects REST base URL) |
| `PAYPAL_PARTNER_MERCHANT_ID` | Platform partner PayPal merchant ID (multiparty, `PayPal-Auth-Assertion`) |

Optional: `PAYPAL_WEBHOOK_ID` for `POST /v1/notifications/verify-webhook-signature`.

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### Braintree environment mapping (server)

```java
import com.braintreegateway.Environment;

Environment btEnv = "Production".equalsIgnoreCase(System.getenv("BRAINTREE_ENVIRONMENT"))
    ? Environment.PRODUCTION
    : Environment.SANDBOX;
```

### Example `application.yml`

```yaml
braintree:
  merchant-id: ${BRAINTREE_MERCHANT_ID}
  public-key: ${BRAINTREE_PUBLIC_KEY}
  private-key: ${BRAINTREE_PRIVATE_KEY}
  environment: ${BRAINTREE_ENVIRONMENT:Sandbox}

paypal:
  environment: ${PAYPAL_ENVIRONMENT:sandbox}
  client-id: ${PAYPAL_CLIENT_ID}
  client-secret: ${PAYPAL_CLIENT_SECRET}
  partner-merchant-id: ${PAYPAL_PARTNER_MERCHANT_ID:}
  webhook-id: ${PAYPAL_WEBHOOK_ID:}
```

## Multiparty payload conventions (PayPal REST)

For PayPal wallet flows in Orders API v2, use **`payment_source.paypal.experience_context`** (return/cancel URLs, branding, locale). **Do not** use the deprecated top-level `application_context` for new integrations.

## Suggested package layout

```
com.example.enterprise
├── config/          # BraintreeGateway bean, PayPal base URL
├── braintree/       # Transactions, vault, webhooks
├── paypal/          # HttpClient, OAuth token cache
├── web/             # @RestController, Thymeleaf controllers
└── web/advice/      # @ControllerAdvice for API errors
```

## Related snippets

- `braintree-client-token.md` — `BraintreeGateway.clientToken().generate()`
- `multiparty-create-order.md` — `POST /v2/checkout/orders` with `platform_fees` and `experience_context`
- `agentic-commerce.md` — Cart / agentic flows with `HttpClient`
