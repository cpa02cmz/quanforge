# Bug Tracking Log

## Critical Bugs Fixed

### [FIXED] Vercel Deployment Schema Validation Errors - PR #139
- **Date**: 2025-12-18
- **Severity**: Critical (Deployment Blocking)
- **Description**: `vercel.json` contained unsupported properties causing validation failures
- **File**: `vercel.json`
- **Issues Fixed**:
  - Removed unsupported `experimental` property (lines 243-255)
  - Removed invalid `regions` properties from global and function configs (line 120, 129, 182)
  - Removed unsupported `cache` properties from function configurations (lines 134, 185)
  - Removed invalid `environment` properties from function definitions (lines 135-178, 186-190)
- **Impact**: Restores Vercel and Cloudflare Workers deployment capability
- **Testing**: ✓ Build successful, ✓ Schema validation compliant

## Minor Issues (Non-Critical)

### [OPEN] ESLint Warnings
- **Severity**: Low
- **Count**: 200+ warnings
- **Categories**:
  - Console statements in API files
  - Unused variables in TypeScript
  - `any` type usage
  - React refresh for exported constants
- **Status**: Non-blocking, can be addressed in future optimization sprints

### [OPEN] Bundle Size Optimization
- **Severity**: Low
- **Description**: Multiple chunks >100KB after minification
- **Files**: Large vendor chunks (charts, react, ai)
- **Recommendation**: Consider code splitting for better performance
- **Status**: Performance optimization opportunity

### [OPEN] Build Warnings
- **Severity**: Low
- **Description**: Dynamic import warnings for advancedAPICache.ts
- **Impact**: No functional impact, but could affect bundle optimization
- **Status**: Monitor during future performance optimization

## Next Steps

1. [ ] Consider implementing Web Crypto API for more secure hashing (if enhancedRateLimit.ts is merged)
2. [ ] Address ESLint warnings in next cleanup sprint
3. [ ] Implement bundle splitting for large chunks (>100KB)
4. [ ] Monitor dynamic import usage and optimize chunk splitting strategy
5. [ ] Add unit tests for critical utilities