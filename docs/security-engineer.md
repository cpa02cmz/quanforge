# Security Engineer Documentation

## Overview

This document outlines the security architecture, practices, and responsibilities for the QuanForge project. As a Security Engineer specialist, your role is to ensure the application maintains a strong security posture through continuous assessment, vulnerability management, and secure coding practices.

**Last Updated**: 2026-02-07  
**Security Posture**: ✅ STRONG (0 vulnerabilities, comprehensive protections in place)

---

## Security Fixes & Improvements (2026-02-07)

### Critical Security Fix: API Key Storage Vulnerability

**Issue**: API keys were being stored in plain localStorage, making them vulnerable to XSS attacks.

**Severity**: HIGH

**Files Affected**:
- `services/securityManager.ts` - Lines 942-971
- `services/security/apiKeyManager.ts` - All methods using localStorage

**Fix Applied**:
1. **Replaced localStorage with SecureStorage**: API keys now stored using Web Crypto API encryption
2. **Updated Methods to Async**: All API key storage/retrieval methods now use async/await pattern
3. **Added TTL Support**: Keys automatically expire with configurable TTL
4. **Namespace Isolation**: API keys use dedicated namespace (`qf_api_keys`) with encryption enabled

**Before (Vulnerable)**:
```typescript
// Storing API key in plain localStorage - VULNERABLE TO XSS
private storeAPIKey(key: string, expiresAt: number): void {
  localStorage.setItem('current_api_key', key);
  localStorage.setItem('api_key_expires', expiresAt.toString());
}

private getCurrentAPIKey(): string {
  return localStorage.getItem('current_api_key') || '';
}
```

**After (Secure)**:
```typescript
private secureStorage = new SecureStorage({
  namespace: 'qf_security',
  encrypt: true,
  maxSize: 1024 * 1024 // 1MB limit
});

private async storeAPIKey(key: string, expiresAt: number): Promise<void> {
  // Use secure storage with encryption instead of localStorage
  await this.secureStorage.set('current_api_key', key, { ttl: expiresAt - Date.now() });
  await this.secureStorage.set('api_key_expires', expiresAt.toString());
}

private async getCurrentAPIKey(): Promise<string> {
  // Retrieve from secure encrypted storage
  const key = await this.secureStorage.get<string>('current_api_key', '');
  return key || '';
}
```

**Security Benefits**:
- ✅ API keys encrypted at rest using AES-GCM with PBKDF2 key derivation
- ✅ Protection against XSS attacks that attempt to steal localStorage data
- ✅ Automatic key expiration with TTL support
- ✅ Namespace isolation prevents cross-contamination
- ✅ Web Crypto API provides production-grade encryption (100,000 iterations)

**Verification**:
- TypeScript compilation: ✅ Zero errors
- Production build: ✅ Successful (11.85s)
- Lint checks: ✅ Pass (no errors in security files)
- npm audit: ✅ 0 vulnerabilities

---

## Current Security Status

### Security Assessment Summary

| Category | Status | Details |
|----------|--------|---------|
| Dependency Vulnerabilities | ✅ PASS | 0 vulnerabilities found (npm audit) |
| Hardcoded Secrets | ✅ PASS | No real secrets in code |
| XSS Prevention | ✅ PASS | DOMPurify used in 7 files |
| Input Validation | ✅ PASS | Comprehensive validation across all inputs |
| Rate Limiting | ✅ PASS | Configured and functional |
| SQL Injection Prevention | ✅ PASS | Built into SecurityManager |
| Prototype Pollution Prevention | ✅ PASS | Implemented in securityManager |
| Security Headers | ✅ PASS | Configured in vercel.json |
| API Key Storage | ✅ FIXED | Now uses SecureStorage with Web Crypto API encryption |

### Recent Security Work (2026-01-08 to 2026-01-10)

#### Security Hardening Assessment (2026-01-08)
- **Scope**: Comprehensive security audit as Principal Security Engineer
- **npm audit**: 0 vulnerabilities found
- **Outdated packages**: Identified but assessed for risk
- **Hardcoded secrets**: None found (only in .env.example and docs)
- **XSS prevention**: DOMPurify properly used
- **Input validation**: SecurityManager comprehensive
- **Rate limiting**: Configured and functional
- **Action Taken**: 
  - Updated react-router-dom: 7.11.0 → 7.12.0 (minor version, low risk)
  - Added security documentation for dangerouslySetInnerHTML in advancedSEO.tsx
  - Verified build: 12.00s, typecheck: passes

#### Security Hardening Assessment (2026-01-09)
- **Scope**: Follow-up security assessment
- **npm audit**: 0 vulnerabilities maintained
- **Updates Applied**:
  - @google/genai: 1.34.0 → 1.35.0 (minor version, security fixes)
  - @supabase/supabase-js: 2.90.0 → 2.90.1 (patch version, bug fixes)
- **Total packages updated**: 7 (includes sub-dependencies)
- **Build verification**: 12.80s, typecheck: passes, 0 vulnerabilities

#### Security Hardening Assessment (2026-01-10)
- **Scope**: Follow-up security assessment
- **npm audit**: 0 vulnerabilities maintained
- **Updates Applied**:
  - @types/node: 25.0.3 → 25.0.5 (patch version, type definitions only)
- **Total packages updated**: 2 (includes sub-dependencies)
- **Build verification**: 13.69s, typecheck: 76 pre-existing errors (unchanged)

### Deferred Updates (Major Versions)

The following major version updates have been **deferred** following security best practices:

| Package | Current | Latest | Rationale |
|---------|---------|--------|-----------|
| vite | 6.4.1 | 7.3.1 | Requires Rolldown migration (breaking changes) |
| eslint-plugin-react-hooks | 5.2.0 | 7.0.1 | Skips v6, potential breaking changes |
| web-vitals | 4.2.4 | 5.1.0 | API changes requiring code updates |

**Rationale for Deferral**:
- Current versions are stable with 0 vulnerabilities
- Major updates introduce breaking changes requiring migration
- Risk outweighs security benefits without active CVEs
- Better to plan migration when ready for feature work

---

## Security Architecture

### Core Security Components

#### 1. SecurityManager (`services/securityManager.ts`)

The central security service providing:

- **Input Sanitization**: `sanitizeInput()`, `sanitizeString()`, `sanitizeSymbol()`
- **Validation**: `sanitizeAndValidate()` for robots, strategies, backtests, users
- **XSS Prevention**: `preventXSS()` with pattern matching
- **SQL Injection Prevention**: `preventSQLInjection()` with pattern detection
- **Rate Limiting**: `checkRateLimit()` with per-user tracking
- **MQL5 Code Validation**: `validateMQL5Code()` for dangerous function detection
- **Safe JSON Parsing**: `safeJSONParse()` with prototype pollution prevention

**Usage Pattern**:
```typescript
import { securityManager } from '../services/securityManager';

// Validate and sanitize data
const validation = securityManager.sanitizeAndValidate(robotData, 'robot');
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}
const sanitizedData = validation.sanitizedData;

// Check rate limits
const rateLimit = securityManager.checkRateLimit(userId);
if (!rateLimit.allowed) {
  throw new Error(`Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`);
}
```

#### 2. EnhancedSecurityManager (`services/enhancedSecurityManager.ts`)

Extended security features:

- **Advanced XSS Detection**: Unicode attack pattern detection
- **Content Security Policy**: CSP header generation
- **API Key Validation**: Secure API key format checking
- **Enhanced Rate Limiting**: Token bucket algorithm implementation

#### 3. CSRF Protection (`services/csrfProtection.ts`)

- Token generation and validation
- Request signing for state-changing operations
- Double-submit cookie pattern implementation

#### 4. Input Validation (`utils/validation.ts`)

Comprehensive validation functions:

- `validateStrategyParams()`: Risk parameters, timeframes, symbols
- `validateBacktestSettings()`: Deposit amounts, simulation days
- `validateRobotName()`: Naming conventions and restrictions
- `validateChatMessage()`: XSS prevention, rate limiting
- `sanitizeInput()`: HTML/script tag removal

**Security Patterns Validated**:
- XSS attempts (javascript:, vbscript:, data:text/html)
- MQL5 dangerous functions (FileOpen, WebRequest, ShellExecute)
- Suspicious keywords (password, secret, key, token, auth)
- Obfuscated content (hex encoding, base64)

---

## Security Headers Configuration

### Vercel Configuration (`vercel.json`)

Security headers implemented:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.googleapis.com;"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### Header Purposes

| Header | Purpose |
|--------|---------|
| Strict-Transport-Security | Forces HTTPS connections (HSTS) |
| Content-Security-Policy | Prevents XSS and data injection attacks |
| X-Content-Type-Options | Prevents MIME type sniffing |
| X-Frame-Options | Prevents clickjacking |
| X-XSS-Protection | Legacy XSS protection for older browsers |
| Referrer-Policy | Controls referrer information leakage |
| Permissions-Policy | Restricts browser feature access |

---

## Vulnerability Management

### Dependency Scanning

**Command**: `npm audit --audit-level=moderate`

**Frequency**: Run before each deployment

**Current Status**: ✅ 0 vulnerabilities

**Process**:
1. Run `npm audit` to identify vulnerabilities
2. Assess risk (critical > high > moderate > low)
3. Update dependencies following version risk guidelines:
   - **PATCH** (x.x.X): Apply immediately (very low risk)
   - **MINOR** (x.X.x): Apply after brief testing (low risk)
   - **MAJOR** (X.x.x): Plan migration (high risk, breaking changes)
4. Verify build and tests pass after updates
5. Document changes in security-engineer.md

### Manual Security Review Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] No `console.log` of sensitive data
- [ ] All user inputs sanitized before use
- [ ] Rate limiting on all public endpoints
- [ ] XSS prevention on all rendered content
- [ ] CSRF tokens on state-changing operations
- [ ] Proper error handling (no stack traces in production)
- [ ] Secure cookie settings (HttpOnly, Secure, SameSite)
- [ ] Content Security Policy configured
- [ ] Security headers in place

---

## Secure Coding Guidelines

### Input Handling

**DO**:
```typescript
// Sanitize all user inputs
const sanitized = securityManager.sanitizeInput(userInput);

// Validate before processing
const validation = securityManager.sanitizeAndValidate(data, 'robot');
if (!validation.isValid) {
  return { error: validation.errors.join(', ') };
}
```

**DON'T**:
```typescript
// Never use user input directly
const query = `SELECT * FROM users WHERE name = '${userInput}'`; // SQL Injection!

// Never trust client-side data
const data = JSON.parse(localStorage.getItem('userData')); // Prototype pollution risk
```

### Output Encoding

**DO**:
```typescript
// Use DOMPurify for HTML content
import DOMPurify from 'dompurify';
const cleanHTML = DOMPurify.sanitize(dirtyHTML);

// Use safe JSON parsing
const data = securityManager.safeJSONParse(jsonString, {});
```

**DON'T**:
```typescript
// Never use dangerouslySetInnerHTML with user content
<div dangerouslySetInnerHTML={{ __html: userContent }} /> // XSS risk!

// Never eval user input
eval(userCode); // Code injection!
```

### Authentication & Authorization

**DO**:
```typescript
// Always verify authentication
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  throw new Error('Unauthorized');
}

// Use RLS policies for database access
// Policies defined in migrations enforce row-level security
```

**DON'T**:
```typescript
// Never trust client-side auth state alone
const isLoggedIn = localStorage.getItem('isLoggedIn'); // Easily forged!

// Never expose sensitive data in client-side storage
localStorage.setItem('apiKey', secretKey); // Visible to XSS attacks
```

---

## Security Testing

### Automated Security Tests

**Location**: `services/gemini.test.ts`, `utils/validation.test.ts`

**Coverage**:
- XSS prevention patterns (javascript:, vbscript:, data:text/html)
- MQL5 dangerous function detection (FileOpen, WebRequest, ShellExecute)
- Suspicious keyword detection (password, secret, key, token)
- Rate limiting functionality
- Input sanitization and validation

**Running Tests**:
```bash
npm test -- services/gemini.test.ts
npm test -- utils/validation.test.ts
```

### Manual Security Testing

1. **XSS Testing**:
   - Try injecting `<script>alert('xss')</script>` in chat messages
   - Verify output is sanitized

2. **Rate Limiting**:
   - Send rapid requests to API endpoints
   - Verify 429 responses after limit exceeded

3. **SQL Injection**:
   - Try `' OR '1'='1` in search fields
   - Verify proper parameterization

4. **CSRF Testing**:
   - Attempt cross-origin POST requests
   - Verify CSRF token validation blocks requests

---

## Incident Response

### Security Incident Classification

| Severity | Examples | Response Time |
|----------|----------|---------------|
| Critical | RCE, SQL Injection, Data breach | Immediate (1 hour) |
| High | XSS, Auth bypass, Privilege escalation | 4 hours |
| Medium | CSRF, Information disclosure | 24 hours |
| Low | Missing headers, Best practice gaps | Next sprint |

### Response Process

1. **Detect**: Monitor for suspicious activity
2. **Contain**: Isolate affected systems
3. **Assess**: Determine scope and impact
4. **Remediate**: Fix vulnerability
5. **Verify**: Confirm fix with testing
6. **Document**: Update security-engineer.md
7. **Communicate**: Notify stakeholders if needed

---

## Security Checklist for New Features

Before deploying new features, verify:

- [ ] All user inputs are sanitized and validated
- [ ] Rate limiting is implemented for API calls
- [ ] Authentication is required for sensitive operations
- [ ] CSRF protection is in place for state-changing operations
- [ ] No sensitive data is logged to console
- [ ] No hardcoded secrets in code
- [ ] Dependencies are up to date (npm audit passes)
- [ ] Security headers are configured
- [ ] XSS prevention is implemented for rendered content
- [ ] Error messages don't expose sensitive information
- [ ] Build passes with no security-related warnings
- [ ] Tests pass including security tests

---

## Common Security Issues & Fixes

### Issue: Unused eslint-disable directives

**Symptom**: Lint errors about unused eslint-disable comments

**Fix**: Remove unnecessary eslint-disable directives

**Example**:
```typescript
// BEFORE (error)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (window.Prism) { /* ... */ }  // No 'any' type used

// AFTER (fixed)
if (window.Prism) { /* ... */ }  // Directive removed
```

### Issue: console statements in production code

**Symptom**: Console warnings in lint output

**Fix**: Replace with scoped logger utility

**Example**:
```typescript
// BEFORE
console.log('Debug message');

// AFTER
import { createScopedLogger } from '../utils/logger';
const logger = createScopedLogger('ModuleName');
logger.log('Debug message');  // Only shows in development
```

---

## Resources

### Internal Documentation

- [Service Architecture](SERVICE_ARCHITECTURE.md) - Service layer security patterns
- [Data Architecture](DATA_ARCHITECTURE.md) - Database security and RLS policies
- [Integration Resilience](INTEGRATION_RESILIENCE.md) - Secure integration patterns

### External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [npm Security Best Practices](https://docs.npmjs.com/security)
- [Vercel Security Headers](https://vercel.com/docs/concepts/edge-network/headers#security-headers)

---

## Maintenance Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| npm audit | Weekly | Security Engineer |
| Dependency updates | As needed | Security Engineer |
| Security documentation review | Monthly | Security Engineer |
| Penetration testing | Quarterly | Security Team |
| Security training | Quarterly | All developers |
| Incident response drill | Semi-annually | Security Team |

---

## Contact & Escalation

For security-related questions or incidents:

1. Check this documentation first
2. Review [AGENTS.md](../AGENTS.md) for historical security decisions
3. Create a security-focused PR with detailed analysis
4. Document all changes in this file

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-07  
**Next Review**: 2026-03-07
