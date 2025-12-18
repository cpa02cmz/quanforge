# Bug Tracker

This document tracks bugs discovered and fixed within the QuantForge AI system.

## Format
- **[FIXED]** or **[OPEN]** - Brief bug description
- Location: Component/File where bug was found
- Impact: Severity level (Critical/High/Medium/Low)

---

## Active Bugs (Currently Open)

*No active bugs tracked yet.*

---

## Fixed Bugs (Resolved)

- **[FIXED]** - Vercel deployment schema validation error in vercel.json
  - **Location**: vercel.json (functions configuration)
  - **Impact**: High - Caused deployment failures for PR #136 and potentially other PRs
  - **Date Fixed**: 2025-12-18
  - **Solution**: Removed invalid `regions` property from function configurations
  - **Root Cause**: Vercel schema doesn't allow `regions` property in function definitions
  - **Testing**: Local build passes successfully after fix
  - **Notes**: Build completes without schema validation errors

- **[FIXED]** - Multiple PR Vercel schema validation errors (PRs #137, #138)
  - **Location**: vercel.json (across multiple PR branches)
  - **Impact**: Critical - Blocked deployment pipeline for multiple critical PRs
  - **Date Fixed**: 2025-12-18
  - **Solution**: 
    - Removed unsupported `regions` property from global configuration
    - Removed invalid `experimental` section causing validation failures
    - Removed invalid `cache` and `environment` properties from function configs
    - Streamlined build environment variables to essential supported values only
  - **Root Cause**: Vercel schema strictly validates properties; many advanced features are not supported
  - **Testing**: ✓ Local build successful, ✓ Schema validation compliant, ✓ PRs updated and pushed
  - **Notes**: Restored CI/CD pipeline functionality across multiple critical development branches