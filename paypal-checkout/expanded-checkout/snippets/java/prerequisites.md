# Prerequisites — PayPal Expanded Checkout (Spring Boot 3 / Java)

Expanded Checkout adds **Card Fields**, **3D Secure**, **Fastlane**, **Apple Pay**, **Google Pay**, and **card vaulting** on top of Standard Checkout. Use this checklist before integrating.

## Runtime

- **Java 17+** (LTS recommended; Spring Boot 3 requires Java 17 as a baseline).
- **Spring Boot 3.x** (`spring-boot-starter-web`, Jackson for JSON).

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
</dependencies>
```

`java.net.http.HttpClient` is included in the JDK — no extra dependency for HTTP calls to PayPal.

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
}
```

## Environment variables

Never commit secrets. Use environment variables, Spring `application.yml` with externalized secrets, or a secrets manager.

| Variable | Description |
|----------|-------------|
| `PAYPAL_CLIENT_ID` | REST app Client ID from the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) |
| `PAYPAL_CLIENT_SECRET` | REST secret — **server only** |
| `PAYPAL_ENVIRONMENT` | `sandbox` or `production` |
| `PAYPAL_WEBHOOK_ID` | Webhook ID — used with `POST /v1/notifications/verify-webhook-signature` |

### REST API base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-m.sandbox.paypal.com` |
| Production | `https://api-m.paypal.com` |

### Example `application.yml`

```yaml
paypal:
  environment: ${PAYPAL_ENVIRONMENT:sandbox}
  client-id: ${PAYPAL_CLIENT_ID}
  client-secret: ${PAYPAL_CLIENT_SECRET}
  webhook-id: ${PAYPAL_WEBHOOK_ID:}
```

## Orders API payload conventions (Expanded Checkout)

- Use **`payment_source.paypal.experience_context`** for PayPal wallet flows — **not** the deprecated top-level `application_context`.
- Use **`payment_source.card`** for card (Card Fields) payments, including `experience_context` (return/cancel URLs for 3DS) and `attributes.verification` for SCA.

## Expanded Checkout eligibility

Expanded Checkout requires **merchant eligibility** (supported countries, currencies, and products). Confirm before a full build:

- [Expanded Checkout eligibility](https://developer.paypal.com/docs/checkout/advanced/eligibility/)

If you only need PayPal-branded buttons without hosted card fields, **Standard Checkout** may be sufficient.

## Suggested package layout

```
com.example.checkout
├── config/          # PayPal base URL, beans
├── paypal/          # HttpClient clients, token provider
├── web/             # @RestController, DTOs
└── web/advice/      # @ControllerAdvice for PayPal errors
```

## Related snippets

- `client-token-generation.md` — OAuth client token for the JS SDK
- `create-order.md` — `POST /v2/checkout/orders` with `payment_source.card`
