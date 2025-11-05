# RulesHub

A comprehensive collection of AI-optimized migration rules and guidelines for popular APIs and platforms. These rules are designed to work seamlessly with AI code assistants like Cursor IDE and Claude Code to provide intelligent, context-aware code suggestions and migrations.

## Table of Contents


- [Available Migration Rules](#available-migration-rules)
  - [PayPal NVP/SOAP to REST API Migration](#paypal-nvpsoap-to-rest-api-migration)
  - [PayPal v5 to v6 Web SDK Migration](#paypal-v5-to-v6-web-sdk-migration)
- [How to Use](#how-to-use)
  - [Method 1: Direct Copy (Recommended)](#method-1-direct-copy-recommended)
  - [Method 2: Git Submodule](#method-2-git-submodule)
  - [Method 3: Reference in Existing Files](#method-3-reference-in-existing-files)
- [Key Benefits](#key-benefits)
  - [Intelligent Code Detection](#intelligent-code-detection)
  - [Comprehensive Coverage](#comprehensive-coverage)
  - [AI-Optimized Design](#ai-optimized-design)
- [Migration Scenarios](#migration-scenarios)
  - [Scenario 1: Starting a New Integration](#scenario-1-starting-a-new-integration)
  - [Scenario 2: Legacy Code Migration](#scenario-2-legacy-code-migration)
  - [Scenario 3: Code Review and Security Audit](#scenario-3-code-review-and-security-audit)
- [Customization](#customization)
  - [Adding Your Own Rules](#adding-your-own-rules)
  - [Environment-Specific Adaptations](#environment-specific-adaptations)
- [Security First](#security-first)
- [Contributing](#contributing)
  - [Contribution Guidelines](#contribution-guidelines)
- [Resources](#resources)
- [License](#license)

## Available Migration Rules

### PayPal NVP/SOAP to REST API Migration

**Location**: `nvp-soap-to-rest-migration/`

Complete migration guide for transitioning from PayPal legacy APIs (NVP/SOAP) to modern REST APIs.

**Features:**

- Automatic legacy code pattern detection
- REST API endpoint mappings with official documentation links
- Multi-language support (Node.js, Python, PHP, Java, .NET, Ruby)
- Security best practices and vulnerability detection
- Side-by-side code transformation examples
- Webhook implementation patterns
- Environment configuration templates

### PayPal v5 to v6 Web SDK Migration

**Location**: `upgrade-to-v6-migration/v5-to-v6-migration/`

Migration guide for transitioning from PayPal v5 Web SDK to PayPal v6 Web SDK with updated patterns and features.

**Features:**

- **Interactive Migration Detection**: Analysis of existing v5 implementations
- **Pattern-Based Conversion**: Detection and transformation of v5 patterns to v6
- **Save Payment/Vault Operations**: Implementation of payment method storage and reuse
- **Payment Methods**: Support for Venmo, Pay Later, and Credit messaging
- **Security Implementation**: Server-side token generation and credential management
- **TypeScript Support**: TypeScript definitions and type-safe implementations
- **Error Handling**: Debug IDs and operational patterns
- **Migration Strategies**: Parallel testing and phased rollout approaches

## How to Use

### Method 1: Direct Copy (Recommended)
Copy the relevant rules file to your project:

```bash
# Choose the appropriate migration rules for your project
cp [migration-folder]/rules.md your-project/.cursor/rules/CURSOR.mdc  # For Cursor IDE
cp [migration-folder]/rules.md your-project/CLAUDE.md     # For Claude Code
```

### Method 2: Git Submodule
Add RulesHub as a submodule to your project:

```bash
cd your-project
git submodule add https://github.com/your-repo/RulesHub.git rules
```

### Method 3: Reference in Existing Files
Add references in your existing `CURSOR.mdc` or `CLAUDE.md`:

```markdown
# Migration Rules
Apply migration patterns from RulesHub/[migration-folder]/rules.md
```

## Key Benefits

### Intelligent Code Detection

- **Pattern Recognition**: AI assistants detect legacy code patterns (NVP/SOAP calls, v5 SDK implementations)
- **Context-Aware Suggestions**: Migration suggestions based on code context
- **Security Scanning**: Detection of security vulnerabilities and practices
- **Setup Analysis**: Detection of current PayPal integration patterns through code analysis

### Comprehensive Coverage

- **Multi-Language Support**: Rules work across JavaScript, TypeScript, Python, PHP, Java, .NET, and more
- **Migration Paths**: From authentication to webhooks, various aspects covered
- **Payment Methods**: Support for save payments, Venmo, Pay Later, and credit messaging
- **Best Practices**: Industry-standard security and performance practices included

### AI-Optimized Design

- **Cursor IDE Integration**: Integration with Cursor's AI capabilities
- **Claude Code Compatible**: Works with Claude Code's context understanding
- **Documentation**: Includes links to official API documentation and examples
- **Migration Support**: Enables parallel testing and phased rollouts
- **TypeScript Definitions**: Type safety and IntelliSense support

## Migration Scenarios

### Scenario 1: Starting a New Integration

When beginning a fresh integration, AI assistants will:

- Suggest API patterns from the start (REST APIs, v6 SDK)
- Provide configuration templates
- Include error handling
- Recommend current practices
- Guide toward implementations

### Scenario 2: Legacy Code Migration

When working with existing legacy code:

- Detect outdated patterns (NVP/SOAP, v5 SDK)
- Suggest equivalents (REST APIs, v6 SDK)
- Provide step-by-step migration guidance
- Support backward compatibility during transition
- Support parallel testing strategies

### Scenario 3: Code Review and Security Audit

During development and review:

- Flag potential security issues
- Suggest performance optimizations
- Recommend API version upgrades (v5 → v6 SDK)
- Support compliance with platform guidelines
- Validate error handling and debug patterns

## Customization

### Adding Your Own Rules
Each migration folder can be extended with project-specific rules:

```markdown
## Custom Project Rules
- Your specific business logic patterns
- Internal coding standards
- Company-specific security requirements
- Custom payment flow implementations
- Environment-specific SDK configurations
```

### Environment-Specific Adaptations
Modify rules for different deployment environments:

```markdown
## Development Environment
- Enable verbose logging
- Use sandbox/test endpoints
- Include debugging information
- Enable PayPal Debug IDs for troubleshooting
- Use development SDK configurations

## Production Environment
- Minimize sensitive data logging
- Use production endpoints
- Enhanced security validation
- Implement proper error handling
```

## Security First

All migration rules prioritize security:

- **Credential Management**: Environment variable recommendations
- **HTTPS Enforcement**: Secure communication patterns only
- **Data Protection**: No logging of sensitive information
- **Vulnerability Detection**: Automatic flagging of security issues
- **Compliance**: Platform-specific compliance requirements
- **Server-Side Token Generation**: Client token patterns
- **Webhook Signature Verification**: Webhook security implementation

## Contributing

Help improve RulesHub by:

1. **Testing Rules**: Use the rules in your projects and provide feedback
2. **Documenting Gaps**: Report missing patterns or edge cases
3. **Adding New Migrations**: Contribute rules for other platforms
4. **Improving Examples**: Enhance code examples and documentation

### Contribution Guidelines
- Test all rules thoroughly before submitting
- Include comprehensive documentation
- Follow existing file structure and naming conventions
- Ensure security best practices are maintained

## Resources

- **API Documentation**: Links to official platform documentation
  - [PayPal REST APIs](https://developer.paypal.com/api/rest/)
  - [PayPal v6 Web SDK](https://docs.paypal.ai/payments/methods/paypal/sdk/js/v6/paypal-checkout)
  - [PayPal Vault/Save Payments](https://docs.paypal.ai/payments/save/sdk/paypal/js-sdk-v6-vault)
- **Migration Guides**: Platform-specific migration resources
- **Community Support**: Developer community forums and support
- **Best Practices**: Industry-standard implementation patterns
- **TypeScript Definitions**: Official type definitions for v6 SDK


---

> **Note**: Start with sandbox/test environments when using migration rules. Validate all implementations against your specific business requirements before deploying to production.
> 
> **v5 to v6 Migration**: If you're currently using PayPal v5 Web SDK, consider migrating to v6 for updated features and TypeScript support. The v6 SDK provides TypeScript definitions, save payment capabilities, and support for payment methods like Venmo and Pay Later.

