# ADR-001: Repository Manager Governance Framework

## Status
**ACCEPTED** - 2026-02-21

## Context
The QuanForge repository requires a comprehensive governance framework to ensure:
- Long-term system resilience and maintainability
- Consistent, auditable decision-making
- Automated enforcement of quality gates
- Risk-adjusted technical debt management

## Decision

### 1. Priority Hierarchy (Non-Negotiable)
All decisions must follow this strict priority order:
1. **SECURITY** - Vulnerabilities, exposure, compliance
2. **CORRECTNESS** - Logic errors, data integrity, contracts
3. **BUILD STABILITY** - Compilation, bundling, deployment
4. **TEST INTEGRITY** - Coverage, reliability, isolation
5. **PERFORMANCE** - Latency, throughput, resource usage
6. **MAINTAINABILITY** - Code quality, documentation, structure
7. **STYLE** - Formatting, naming conventions, aesthetics

### 2. Branch Governance

#### Protected Branches
- `main` - Production branch (NEVER force push, NEVER delete)
- All merges to `main` require:
  - Green CI (build, lint, typecheck, test)
  - No merge conflicts
  - Squash merge preferred for linear history

#### Branch Naming Convention
```
<type>/<description>-<date-or-issue>
```
Types: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `security/`

#### Stale Branch Policy
- Branches older than **14 days** with no activity are candidates for deletion
- Merged branches should be deleted within **24 hours**
- Automated cleanup runs weekly

### 3. Commit Standards

#### Conventional Commits (REQUIRED)
```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting, no code change
- `refactor:` - Code restructuring
- `test:` - Adding/updating tests
- `chore:` - Maintenance tasks
- `security:` - Security-related changes

### 4. Semantic Versioning
```
MAJOR.MINOR.PATCH[-PRERELEASE]

- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible
- PRERELEASE: -alpha, -beta, -rc.N
```

Current version: `1.6.0`

### 5. CI/CD Quality Gates

#### Required Checks (Must Pass)
| Check | Timeout | Failure Policy |
|-------|---------|----------------|
| Build | 5 min | BLOCK |
| TypeScript | 3 min | BLOCK |
| Lint | 3 min | BLOCK (errors only) |
| Tests | 5 min | BLOCK |
| Security Audit | 2 min | WARN (moderate+ BLOCK) |

#### Quality Thresholds
- Test Coverage: Target 80% (current: ~70%)
- Lint Errors: 0 (current: 0)
- TypeScript Errors: 0 (current: 0)
- Security Vulnerabilities (prod): 0 (current: 0)

### 6. Dependency Management

#### Update SLAs
| Severity | Patch Window |
|----------|--------------|
| Critical | 24 hours |
| High | 7 days |
| Moderate | 30 days |
| Low | 90 days |

#### Allowed Actions
- `npm audit fix` - Auto-apply safe patches
- `npm update` - Within semver ranges
- Major upgrades require PR review

### 7. Technical Debt Policy

#### Risk-Adjusted ROI Analysis
Before addressing technical debt, evaluate:
1. **Impact**: How many users/developers affected?
2. **Frequency**: How often is the code touched?
3. **Risk**: What's the breakage potential?
4. **Effort**: How long to remediate?

**Action Threshold**: ROI > 2.0 (impact × frequency) / (risk × effort)

#### Technical Debt Categories
| Category | Auto-Remediate | Requires Review |
|----------|----------------|-----------------|
| Style/Formatting | YES | NO |
| Documentation | YES | NO |
| Type Safety (any) | NO | YES |
| Test Coverage | NO | YES |
| Architecture | NO | YES |

### 8. PR Processing Rules

#### Merge Requirements (ALL must be true)
- [ ] No merge conflicts
- [ ] All CI checks green
- [ ] At least 1 approval (for security-sensitive changes)
- [ ] Linked to issue (if applicable)
- [ ] No unresolved comments

#### Auto-Merge Allowed
- Documentation-only changes
- Non-breaking dependency updates
- Style/formatting fixes
- Test additions (no logic changes)

### 9. Rollback Capability

#### Requirements
- Every merge must be revertible
- Tag releases for production deploys
- Maintain rollback scripts for schema changes
- Keep last 3 release branches

### 10. Audit Trail

All governance actions must log:
- Timestamp (UTC)
- Actor (human or agent)
- Action type
- Target (branch, PR, issue)
- Rationale
- Result

## Consequences

### Positive
- Deterministic, auditable decision-making
- Reduced human error in routine operations
- Clear escalation paths for edge cases
- Long-term system resilience

### Negative
- Initial overhead for setting up automation
- May slow down "quick fixes" (intentional)
- Requires discipline to maintain

## Compliance

This ADR is effective immediately and supersedes any conflicting practices. All repository maintainers and automated agents must adhere to these policies.

---

**Author**: Repository Manager Agent
**Date**: 2026-02-21
**Review Period**: Ongoing
**Supersedes**: None
