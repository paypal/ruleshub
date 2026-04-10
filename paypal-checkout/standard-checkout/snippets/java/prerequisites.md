# Prerequisites — PayPal Standard Checkout (Java / Spring Boot)

Use this checklist before integrating PayPal Standard Checkout with a Spring Boot backend.

## Runtime and build

| Requirement | Notes |
|---------------|--------|
| **Java** | **17+** (LTS recommended; Java 21 supported by Spring Boot 3.2+) |
| **Spring Boot** | **3.x** (`spring-boot-starter-parent`) |
| **Build** | **Maven** or **Gradle** |

## Core dependencies

**Maven (`pom.xml`)**

```xml
<properties>
  <java.version>17</java.version>
</properties>

<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
  </dependency>
  <!-- Optional: load .env in dev (pick one approach) -->
  <dependency>
    <groupId>io.github.cdimascio</groupId>
    <artifactId>dotenv-java</artifactId>
    <version>3.0.0</version>
  </dependency>
  <!-- Or use Spring Boot 3.2+ with spring.config.import=optional:file:.env -->
  <!-- Or: me.paulschwarz:spring-boot-starter-dotenv (community) -->
</dependencies>
```

**Gradle (`build.gradle` — Kotlin DSL)**

```kotlin
java {
  toolchain {
    languageVersion.set(JavaLanguageVersion.of(17))
  }
}

dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
  implementation("com.fasterxml.jackson.core:jackson-databind")
  implementation("io.github.cdimascio:dotenv-java:3.0.0")
}
```

`spring-boot-starter-web` brings Jackson on the classpath; listing `jackson-databind` explicitly documents intent for JSON mapping to/from PayPal APIs.

## HTTP client

Use **`java.net.http.HttpClient`** (Java 11+) for PayPal REST calls—no extra dependency. Alternatively, **OkHttp** (`com.squareup.okhttp3:okhttp`) if you need interceptors or advanced connection pooling.

## Environment variables

Configure secrets and mode outside source control.

| Variable | Purpose |
|----------|---------|
| `PAYPAL_CLIENT_ID` | REST app client ID |
| `PAYPAL_CLIENT_SECRET` | REST app secret |
| `PAYPAL_MODE` | `sandbox` or `live` (maps to API base URL) |

**Base URLs**

- **Sandbox:** `https://api-m.sandbox.paypal.com`
- **Production:** `https://api-m.paypal.com`

**Spring Boot (`application.yml`)**

```yaml
paypal:
  client-id: ${PAYPAL_CLIENT_ID}
  client-secret: ${PAYPAL_CLIENT_SECRET}
  mode: ${PAYPAL_MODE:sandbox}
```

**Injection example**

```java
@Value("${paypal.client-id}")
private String clientId;

@Value("${paypal.client-secret}")
private String clientSecret;

@Value("${paypal.mode}")
private String mode;

public String paypalApiBase() {
  return "live".equalsIgnoreCase(mode)
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
}
```

Or with `System.getenv("PAYPAL_CLIENT_ID")` where you prefer not to bind to Spring properties.

## Optional: dotenv for local development

With **dotenv-java**, load a `.env` file before Spring starts (e.g. in `main`):

```java
import io.github.cdimascio.dotenv.Dotenv;

public static void main(String[] args) {
  Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
  dotenv.entries().forEach(e -> System.setProperty(e.getKey(), e.getValue()));
  SpringApplication.run(Application.class, args);
}
```

Keep `.env` out of version control (`.gitignore`).

## PayPal developer setup

1. Create a **REST app** in the [PayPal Developer Dashboard](https://developer.paypal.com/).
2. Copy **Client ID** and **Secret** for Sandbox and Live.
3. Enable the features you need (Standard Checkout, webhooks, etc.) per app settings.

## Next steps

- Server: OAuth / client token → `client-token-generation.md`
- Client: JS SDK → `sdk-initialization.md`
- Orders: `create-order.md`, `capture-order.md`, `get-order-details.md`
