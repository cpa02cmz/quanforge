# DevOps Engineer Documentation

## Overview

This document outlines the DevOps infrastructure, CI/CD workflows, deployment configurations, and operational guidelines for the QuantForge AI project.

## Current Status

**Last Updated**: 2026-02-07  
**Build Status**: ✅ PASSING  
**Test Status**: ✅ 423/423 TESTS PASSING  
**TypeScript**: ✅ ZERO ERRORS  
**Lint Status**: ⚠️ WARNINGS ONLY (1681 warnings, 0 errors)

---

## CI/CD Infrastructure

### GitHub Actions Workflows

#### 1. on-push.yml
**Trigger**: On every push to any branch  
**Purpose**: Automated code analysis, issue creation, and PR management  
**Runner**: `ubuntu-24.04-arm`  
**Timeout**: 30 minutes per job

**Jobs**:
- **00-11 flows**: OpenCode agent executions for automated code analysis
- **on-push**: Repository maintenance and PR/issue management

**Environment Variables**:
```yaml
VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
VITE_SUPABASE_KEY: ${{ secrets.VITE_SUPABASE_KEY }}
CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

#### 2. on-pull.yml
**Trigger**: On pull requests, workflow_dispatch, after iterate workflow  
**Purpose**: PR validation, branch management, and merge automation  
**Runner**: `ubuntu-24.04-arm`  
**Timeout**: 60 minutes

**Jobs**:
- Branch management (agent-workspace sync)
- Dependency installation
- OpenCode CLI execution
- PR automation and merging

#### 3. iterate.yml
**Trigger**: workflow_dispatch  
**Purpose**: Iterative development workflow

#### 4. parallel.yml
**Trigger**: workflow_dispatch  
**Purpose**: Parallel execution workflows

#### 5. workflow-monitor.yml
**Trigger**: workflow_dispatch  
**Purpose**: Monitor workflow execution

#### 6. oc.yml / oc-new.yml
**Trigger**: workflow_dispatch  
**Purpose**: OpenCode agent execution workflows

### Concurrency Control

All workflows use a global concurrency group to prevent parallel execution conflicts:
```yaml
concurrency:
  group: global
  cancel-in-progress: false
```

### Queue Management

Uses `softprops/turnstyle@v2` for queue management:
- Poll interval: 30 seconds
- Same-branch-only: false (global queue)

---

## Deployment Configuration

### Vercel (Primary Platform)

**Configuration File**: `vercel.json`

```json
{
  "version": 2,
  "buildCommand": "npm ci --prefer-offline --no-audit && npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci --prefer-offline --no-audit",
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  },
  "headers": [...]
}
```

**Build Optimizations**:
- `--prefer-offline`: Use cached packages when available
- `--no-audit`: Skip vulnerability audit during build (faster)
- `--max-old-space-size=4096`: Increase Node.js heap size for large builds

**Security Headers**:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security: HSTS with preload
- Content-Security-Policy: Comprehensive CSP
- Permissions-Policy: Restricted feature access

### Cloudflare Workers (Secondary)

**Status**: ⚠️ NOT CONFIGURED  
**Issue**: Cloudflare Workers requires dashboard-level configuration for Vite SPA  
**Note**: Primary deployment target is Vercel

---

## Build System

### Vite Configuration

**Build Tool**: Vite 6.4.1  
**Target**: ES2020  
**Output Directory**: `dist`

**Key Scripts**:
```bash
npm run build              # Standard production build
npm run build:edge         # Edge-optimized build
npm run build:analyze      # Build with bundle analyzer
npm run build:production   # Alias for build:edge
npm run vercel-build       # Vercel-specific build command
```

### Build Performance

**Current Metrics** (as of 2026-02-07):
- Build Time: ~12.41s
- TypeScript Compilation: <1s
- Test Execution: ~2.98s
- Total CI Time: ~15-20 minutes

**Bundle Analysis**:
- ai-vendor: 246.96 kB (largest chunk)
- chart-vendor: 208.98 kB
- react-core: 189.44 kB
- vendor-misc: 138.05 kB
- supabase-vendor: 101.89 kB

### Optimization Strategies

1. **Code Splitting**: Dynamic imports for AI services
2. **Manual Chunks**: Vendor separation (react, charts, supabase)
3. **Tree Shaking**: ES modules for dead code elimination
4. **Compression**: Gzip enabled (50-70% size reduction)

---

## Dependency Management

### Package Manager

**Tool**: npm  
**Lock File**: `package-lock.json`

### Security Audit

**Command**: `npm audit`

**Current Status** (2026-02-07):
- ✅ 0 vulnerabilities
- ✅ All dependencies up to date

### Major Dependencies

**Production**:
- React 19.2.3
- React Router DOM 7.12.0
- Supabase JS 2.90.1
- Google GenAI 1.35.0
- Recharts 3.6.0

**Development**:
- TypeScript 5.9.3
- Vite 6.4.1
- Vitest 4.0.16
- ESLint 9.39.2

### Deferred Updates

**Major Version Updates Pending**:
- vite: 6.4.1 → 7.3.1 (requires Rolldown migration)
- eslint-plugin-react-hooks: 5.2.0 → 7.0.1 (skips v6)
- web-vitals: 4.2.4 → 5.1.0 (API changes)

**Rationale**: Current versions stable with 0 vulnerabilities. Major updates introduce breaking changes requiring planned migration.

---

## Testing Infrastructure

### Test Framework

**Tool**: Vitest 4.0.16  
**UI**: `@vitest/ui` 4.0.16  
**Coverage**: Built-in coverage reporting

### Test Commands

```bash
npm run test              # Run tests in watch mode
npm run test:run          # Run tests once (CI)
npm run test:coverage     # Run with coverage report
npm run test:ui           # Run with UI
npm run test:performance  # Performance-specific tests
npm run test:edge         # Edge environment tests
```

### Test Configuration

**Files**:
- `vite.config.ts` - Main Vitest config
- `vite.edge.config.ts` - Edge environment config
- `vite.performance.config.ts` - Performance testing config

### Test Results

**Current Status**:
- Test Files: 9 passing
- Tests: 423 passing
- Duration: ~2.98s
- Coverage: Critical paths covered

---

## Linting & Code Quality

### ESLint Configuration

**Version**: 9.39.2  
**Config**: `@eslint/js` with TypeScript support

**Commands**:
```bash
npm run lint         # Run linter
npm run lint:fix     # Fix auto-fixable issues
```

### Current Status

**Warnings**: 1681 (primarily `any` types and console statements)  
**Errors**: 0  

**Common Warning Types**:
- `@typescript-eslint/no-explicit-any`: 905 instances
- `no-console`: ~440 instances
- `@typescript-eslint/no-unused-vars`: Variable declarations

### Security Linting

Security-focused rules enabled:
- `no-useless-escape`: Regex pattern validation
- `no-prototype-builtins`: Safe object property access
- `no-control-regex`: Control character detection

---

## Environment Variables

### Required Variables

**Supabase**:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**AI Services**:
```bash
VITE_GEMINI_API_KEY=your-gemini-key
```

**Optional**:
```bash
VITE_MOCK_MODE=true              # Enable mock mode
ENABLE_EDGE_METRICS=true         # Enable edge metrics
```

### GitHub Secrets

All sensitive values stored as GitHub Secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GEMINI_API_KEY`

---

## Monitoring & Observability

### Performance Monitoring

**Build Performance**:
- Tracked in build output
- Target: <15s for production builds

**Runtime Performance**:
- Web Vitals integration (v4.2.4)
- Core Web Vitals: CLS, INP, LCP, FCP, TTFB
- Custom performance markers

### Error Tracking

**Current Approach**:
- Console-based logging
- Scoped logger utility (utils/logger.ts)
- Future: Integration with error tracking service

### Health Checks

**Build Health**:
- TypeScript compilation
- Lint checks
- Test execution
- Bundle size analysis

---

## Operational Procedures

### Release Process

1. **Pre-release Checks**:
   ```bash
   npm run typecheck
   npm run lint
   npm run test:run
   npm run build
   ```

2. **Version Update**:
   - Update version in `package.json`
   - Tag release: `git tag v1.x.x`

3. **Deployment**:
   - Push to main triggers Vercel deployment
   - Monitor deployment dashboard
   - Verify production build

### Rollback Procedure

1. **Vercel Dashboard**:
   - Navigate to project
   - Select previous deployment
   - Click "Promote to Production"

2. **Git Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```

### Branch Strategy

**Main Branches**:
- `main` - Production branch
- `devops-engineer` - DevOps specific changes
- `agent-workspace` - Agent automated work

**Feature Branches**:
- Create from `main`
- Name: `feature/description` or `fix/description`
- Merge via PR with CI checks

---

## Known Issues & Solutions

### 1. Dynamic Import Warning

**Issue**: `dynamicSupabaseLoader.ts` dynamically imported but also statically imported  
**Impact**: Warning only - does not affect functionality  
**Status**: Known limitation, acceptable

### 2. Large Bundle Chunks

**Issue**: Several chunks >100 kB after minification  
**Chunks Affected**:
- ai-vendor: 246.96 kB
- chart-vendor: 208.98 kB
- react-core: 189.44 kB

**Solution**: Current code splitting sufficient for application size  
**Status**: Monitoring, not critical

### 3. Lint Warnings

**Issue**: 1681 warnings (primarily `any` types)  
**Impact**: No functional impact  
**Solution**: Ongoing code quality improvements  
**Status**: Low priority

### 4. Test stderr Output

**Issues**:
- storage.test.ts: Failed to parse stored value
- mockImplementation.test.ts: Storage quota exceeded messages

**Impact**: Expected behavior in tests, not actual failures  
**Status**: Non-critical, informational

---

## Best Practices

### CI/CD

1. **Always sync branch before creating PR**
2. **Wait for all CI checks to pass before merging**
3. **Never force push to main**
4. **Use semantic commit messages**

### Deployment

1. **Test locally before pushing**:
   ```bash
   npm run build && npm run typecheck && npm run lint
   ```

2. **Monitor Vercel dashboard after deployment**
3. **Verify critical paths in production**

### Security

1. **Never commit secrets**
2. **Use GitHub Secrets for sensitive data**
3. **Regular dependency audits**: `npm audit`
4. **Keep security headers up to date**

### Performance

1. **Monitor bundle sizes**
2. **Use dynamic imports for large libraries**
3. **Enable compression in production**
4. **Regular performance testing**

---

## Troubleshooting

### Build Failures

**TypeScript Errors**:
```bash
npm run typecheck  # Identify errors
# Fix errors in source files
```

**Lint Errors**:
```bash
npm run lint:fix   # Auto-fix issues
npm run lint       # Check remaining
```

**Test Failures**:
```bash
npm run test:run   # Run tests
# Review failure output
```

### Deployment Issues

**Vercel Build Failures**:
1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Check for TypeScript errors
4. Ensure `vercel.json` is valid JSON

**Cloudflare Workers**:
- Currently not configured
- Use Vercel for deployments

### Performance Issues

**Slow Builds**:
- Clear cache: `npm run clean`
- Check for circular dependencies
- Analyze bundle: `npm run build:analyze`

**Large Bundles**:
- Review manual chunks in vite.config.ts
- Consider lazy loading
- Remove unused dependencies

---

## Contact & Resources

### Documentation

- `/docs/SERVICE_ARCHITECTURE.md` - Service layer documentation
- `/docs/QUICK_START.md` - User guide
- `/docs/INTEGRATION_RESILIENCE.md` - Resilience system docs
- `/docs/DATA_ARCHITECTURE.md` - Data layer documentation

### Tools

- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Actions**: Repository → Actions tab
- **Supabase Dashboard**: https://app.supabase.com

### Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build

# Quality Assurance
npm run typecheck        # TypeScript check
npm run lint             # Lint check
npm run lint:fix         # Fix lint issues
npm run test:run         # Run tests

# Deployment
npm run vercel-build     # Vercel build command
npm run build:production # Full production build
npm run build:analyze    # Build with analysis

# Utilities
npm run clean            # Clean build cache
npm audit                # Security audit
npm outdated             # Check outdated packages
```

---

## Changelog

### 2026-02-07 - DevOps Documentation Created
- Initial DevOps engineer documentation
- Documented CI/CD workflows
- Documented deployment configuration
- Added troubleshooting guide
- Documented current status and metrics

---

*This document is maintained by the DevOps Engineer agent. Last updated: 2026-02-07*
