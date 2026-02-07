# Security Engineering Documentation

## Overview

This document outlines the security architecture, implementation details, and best practices for the QuantForge AI application.

## Current Security Posture

### Security Status: EXCELLENT

- **npm audit**: 0 vulnerabilities
- **TypeScript**: 0 compilation errors
- **Security Headers**: Comprehensive CSP and security headers implemented
- **Input Validation**: Multi-layer validation system in place
- **XSS Prevention**: DOMPurify integration with comprehensive sanitization
- **SQL Injection Prevention**: Pattern-based detection and sanitization
- **CSRF Protection**: Token-based CSRF protection implemented
- **Rate Limiting**: Multi-tier rate limiting (basic, premium, enterprise)

## Security Architecture

### Core Security Components

#### 1. SecurityManager (`services/securityManager.ts`)
The central security service providing:

- **Input Sanitization & Validation**: Comprehensive validation for robots, strategies, backtests, and user data
- **XSS Prevention**: Pattern-based detection and removal of XSS attempts
- **SQL Injection Prevention**: Pattern-based SQL injection detection
- **Rate Limiting**: Adaptive rate limiting with tier-based limits
- **CSRF Protection**: Secure token generation and validation
- **WAF (Web Application Firewall)**: Pattern-based threat detection
- **CSP Monitoring**: Content Security Policy violation tracking
- **API Key Validation**: Type-specific API key validation (Gemini, Supabase, TwelveData)
- **Prototype Pollution Protection**: Detection and prevention of prototype pollution attacks
- **MQL5 Code Validation**: Dangerous function detection in generated trading code

**Key Methods:**
- `sanitizeAndValidate()` - Main validation entry point
- `sanitizeInput()` - Type-specific input sanitization
- `preventXSS()` - XSS pattern detection and removal
- `preventSQLInjection()` - SQL injection detection
- `checkRateLimit()` - Rate limiting checks
- `detectWAFPatterns()` - WAF threat detection
- `validateMQL5Code()` - Trading code security validation

#### 2. Input Validation (`utils/inputValidation.ts`)
Additional input validation utilities:
- Prompt sanitization
- Length validation
- Token abuse prevention

#### 3. Validation Service (`utils/validation.ts`, `utils/validationService.ts`)
Comprehensive validation service:
- Strategy parameter validation
- Backtest settings validation
- Robot name validation
- Chat message validation with security checks
- API key format validation
- Symbol validation

**Security Patterns Detected:**
- XSS patterns (javascript:, vbscript:, data:text/html)
- MQL5 dangerous functions (FileOpen, WebRequest, ShellExecute)
- Suspicious keywords (password, secret, key, token, hack, exploit)
- Obfuscated content (hex encoding, base64)

### Security Headers (vercel.json)

Comprehensive security headers implemented:

```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'...",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=()..."
}
```

**CSP Directives:**
- `default-src 'self'` - Only allow same-origin content
- `script-src` - Allow self, inline scripts, and trusted analytics
- `style-src` - Allow self, inline styles, and Google Fonts
- `connect-src` - Restrict API connections to known endpoints
- `object-src 'none'` - Block Flash and other plugins
- `frame-ancestors 'none'` - Prevent clickjacking

### Environment Variables Security

**No Hardcoded Secrets**: All sensitive configuration uses environment variables:

```typescript
// Good: Using environment variables
const apiKey = process.env['VITE_API_KEY'];
const supabaseUrl = process.env['VITE_SUPABASE_URL'];

// Bad: Never do this
const apiKey = 'sk-abc123...'; // HARDCODED SECRET!
```

**Environment Files:**
- `.env.example` - Template with placeholder values
- `.env.local` - Local development (gitignored)
- Vercel dashboard - Production secrets

## Security Best Practices

### 1. Input Validation

**Always validate and sanitize user input:**

```typescript
import { securityManager } from '../services/securityManager';

// Validate robot data
const result = securityManager.sanitizeAndValidate(robotData, 'robot');
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
  return;
}
const sanitizedData = result.sanitizedData;
```

### 2. XSS Prevention

**Use DOMPurify for HTML content:**

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML content
const cleanHtml = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p'],
  ALLOWED_ATTR: ['class'],
  KEEP_CONTENT: true
});
```

**Or use SecurityManager for general input:**

```typescript
const cleanInput = securityManager.sanitizeInput(userInput, 'text');
```

### 3. CSRF Protection

**Generate and validate CSRF tokens:**

```typescript
// Generate token
const csrfToken = securityManager.generateCSRFToken(sessionId);

// Validate token
const isValid = securityManager.validateCSRFToken(sessionId, token);
if (!isValid) {
  throw new Error('Invalid CSRF token');
}
```

### 4. Rate Limiting

**Check rate limits before processing:**

```typescript
const rateLimitResult = securityManager.checkAdaptiveRateLimit(
  userId, 
  userTier // 'basic', 'premium', 'enterprise'
);

if (!rateLimitResult.allowed) {
  console.warn('Rate limit exceeded');
  return;
}
```

**Tier Limits:**
- Basic: 100 requests/minute
- Premium: 500 requests/minute
- Enterprise: 2000 requests/minute

### 5. API Key Validation

**Validate API keys before use:**

```typescript
const isValid = securityManager.validateAPIKey(apiKey, 'gemini');
if (!isValid) {
  throw new Error('Invalid API key format');
}
```

**Supported Types:**
- `gemini` - Google Gemini API keys
- `supabase` - Supabase JWT tokens
- `twelvedata` - Twelve Data API keys
- `generic` - Generic API key validation

### 6. Safe JSON Parsing

**Use safeJSONParse to prevent prototype pollution:**

```typescript
const data = securityManager.safeJSONParse(jsonString);
if (data === null) {
  console.error('Failed to parse JSON or prototype pollution detected');
}
```

### 7. MQL5 Code Security

**Validate generated trading code:**

```typescript
const codeValidation = securityManager.validateMQL5Code(mql5Code);
if (!codeValidation.isValid) {
  console.error('Security issues:', codeValidation.errors);
  // Code is automatically sanitized
  const safeCode = codeValidation.sanitizedCode;
}
```

**Dangerous Functions Blocked:**
- File operations (FileOpen, FileWrite, FileDelete)
- Network operations (WebRequest, SocketCreate)
- System operations (ShellExecute, WinExec)
- Trade operations (OrderSend, PositionOpen)
- Alert/Notification functions

## Security Testing

### Running Security Tests

```bash
# Run all tests including security tests
npm run test

# Run security-specific tests
npm run test -- security

# Run with coverage
npm run test:coverage
```

### Security Test Coverage

Current security test coverage includes:
- ✅ XSS prevention tests
- ✅ SQL injection prevention tests
- ✅ Input validation tests
- ✅ Rate limiting tests
- ✅ CSRF token tests
- ✅ API key validation tests
- ✅ MQL5 code validation tests
- ✅ Prototype pollution tests

## Security Monitoring

### CSP Violation Monitoring

The application automatically monitors CSP violations:

```typescript
// Setup CSP monitoring
securityManager.monitorCSPViolations();

// Check for violations
const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
```

### Security Metrics

Access security statistics:

```typescript
const stats = securityManager.getComprehensiveSecurityStats();
console.log('WAF Stats:', stats.wafStats);
console.log('CSP Stats:', stats.cspStats);
console.log('Rate Limit Stats:', stats.rateLimitStats);
```

## Threat Detection

### WAF (Web Application Firewall)

Automatic threat detection for:
- SQL Injection
- Cross-Site Scripting (XSS)
- Path Traversal
- Command Injection
- LDAP Injection
- NoSQL Injection
- XXE (XML External Entity)
- SSRF (Server-Side Request Forgery)
- File Inclusion
- Buffer Overflow attempts

### Bot Detection

Bot detection analyzes:
- User-Agent patterns
- Request frequency
- Consistent timing patterns
- Missing headers

```typescript
const botCheck = securityManager.detectEdgeBot(userAgent, ip, requestPattern);
if (botCheck.isBot) {
  console.warn(`Bot detected: ${botCheck.botType} (confidence: ${botCheck.confidence}%)`);
}
```

## Security Checklist

### Development Checklist

- [ ] No hardcoded secrets or API keys
- [ ] All user input is validated and sanitized
- [ ] DOMPurify used for HTML rendering
- [ ] CSRF tokens implemented for state-changing operations
- [ ] Rate limiting applied to API endpoints
- [ ] Security headers configured
- [ ] Dependencies updated (npm audit)
- [ ] TypeScript compilation passes
- [ ] Security tests passing

### Deployment Checklist

- [ ] Environment variables configured in Vercel dashboard
- [ ] CSP headers tested in production
- [ ] Rate limiting rules configured
- [ ] Security monitoring enabled
- [ ] Error reporting configured
- [ ] HTTPS enforced (HSTS)

## Security Recommendations

### High Priority

1. **Regular Dependency Updates**
   - Run `npm audit` weekly
   - Update dependencies promptly for security patches
   - Current status: 0 vulnerabilities ✅

2. **Content Security Policy Refinement**
   - Monitor CSP violations in production
   - Refine CSP based on actual usage patterns
   - Consider removing 'unsafe-inline' for scripts if possible

3. **Rate Limiting Tuning**
   - Monitor rate limit effectiveness
   - Adjust limits based on usage patterns
   - Consider IP-based blocking for repeat offenders

### Medium Priority

1. **Security Headers Audit**
   - Test security headers with securityheaders.com
   - Verify all headers are working as expected

2. **Input Validation Expansion**
   - Add validation for new input types as features are added
   - Consider additional MQL5 security patterns

3. **Logging Enhancement**
   - Implement structured logging for security events
   - Set up alerts for suspicious patterns

### Low Priority

1. **Penetration Testing**
   - Consider third-party security audit
   - Test edge cases and bypass attempts

2. **Bug Bounty Program**
   - Consider establishing bug bounty program
   - Document security disclosure process

## Security Contacts

For security-related issues:
- Create a GitHub issue with `[SECURITY]` prefix
- For sensitive issues, contact maintainers directly

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Vercel Security Headers](https://vercel.com/docs/concepts/edge-network/headers)

## Last Updated

2026-02-07 - Security audit completed with 0 vulnerabilities
