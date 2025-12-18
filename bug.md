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
- **Location**: vercel.json (experimental property)
- **Impact**: High - Caused deployment failures for PR #135 and potentially other PRs
- **Date Fixed**: 2025-12-18
- **Solution**: Removed experimental section containing edgeFunctions and allowedHosts
- **Notes**: Build passes successfully after fix