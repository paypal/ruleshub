#### Prerequisites

##### Programming language runtime

- **Java 8+ or newer**
- **maven** - For dependency management and build

##### Required Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `com.google.code.gson:gson` | 2.10.1 | JSON serialization/deserialization |
| `io.github.cdimascio:dotenv-java` | 3.0.0 | Environment variable management from .env files |

##### Build Plugins

- `maven-compiler-plugin`
- `exec-maven-plugin`

To install these dependencies, execute the below command.

```sh
mvn clean install
```

 