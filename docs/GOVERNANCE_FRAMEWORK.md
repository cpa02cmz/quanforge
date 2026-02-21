# Repository Governance Framework

**Version**: 1.0.0
**Last Updated**: 2026-02-21
**Owner**: Repository Manager Agent

---

## 1. Purpose

This document defines the governance policies and procedures for the QuanForge repository. It establishes deterministic rules for code quality, security, branching, and release management.

---

## 2. Branching Strategy

### 2.1 Protected Branches

| Branch | Protection Level | Merge Strategy | Purpose |
|--------|------------------|----------------|---------|
| `main` | Full Protection | Merge commits only | Production-ready code |
| `develop` | Protected | Rebase preferred | Integration branch |

### 2.2 Branch Naming Convention

```
<type>/<description>-<issue-number>

Types:
- feat/     - New features
- fix/      - Bug fixes
- refactor/ - Code refactoring
- docs/     - Documentation changes
- test/     - Test additions/changes
- chore/    - Maintenance tasks
- hotfix/   - Production hotfixes
```

### 2.3 Branch Lifecycle

1. **Creation**: From `main` or `develop`
2. **Development**: Regular commits following Conventional Commits
3. **Review**: Pull Request with required approvals
4. **Merge**: Squash and merge to `main`, merge commits to `develop`
5. **Cleanup**: Delete branch after merge

### 2.4 Stale Branch Policy

- **Definition**: Branch with no activity for >7 days
- **Merged Branches**: Delete immediately
- **Unmerged Branches**: Create issue for review, delete after 30 days of inactivity

---

## 3. Merge vs Rebase Strategy

### 3.1 When to Merge

- Feature branches → `main`: **Squash and merge**
- Feature branches → `develop`: **Merge commit**
- Hotfix branches → `main`: **Merge commit** (preserves history)

### 3.2 When to Rebase

- Updating feature branch with `main` changes
- Cleaning up local commit history before PR
- Maintaining linear history on `develop`

### 3.3 Prohibited Actions

- ❌ Force push to protected branches
- ❌ Merge without passing CI
- ❌ Rebase published branches

---

## 4. CI/CD Requirements

### 4.1 Required Status Checks

All PRs must pass these checks before merge:

| Check | Command | Requirement |
|-------|---------|-------------|
| Build | `npm run build` | Success |
| Lint | `npm run lint` | 0 errors |
| TypeCheck | `npm run typecheck` | 0 errors |
| Tests | `npm run test:run` | 100% pass |

### 4.2 Quality Gates

```yaml
Quality Gate: BLOCKING
  - Build: SUCCESS
  - Lint Errors: 0
  - TypeScript Errors: 0
  - Test Pass Rate: 100%
  - Security (Production): 0 critical/high
```

### 4.3 Auto-Fix Policy

| Issue Type | Auto-Fix | Action |
|------------|----------|--------|
| Lint warnings | ✅ Yes | `npm run lint:fix` |
| Format issues | ✅ Yes | Prettier auto-format |
| Import sorting | ✅ Yes | Auto-sort imports |
| Type errors | ❌ No | Manual fix required |
| Test failures | ❌ No | Manual fix required |
| Security issues | ❌ No | Manual review required |

---

## 5. Security Requirements

### 5.1 Vulnerability Patch Windows

| Severity | Production | Development |
|----------|------------|-------------|
| Critical | 24 hours | 7 days |
| High | 7 days | 14 days |
| Moderate | 14 days | 30 days |
| Low | 30 days | 90 days |

### 5.2 Security Scanning

- **npm audit**: Run on every CI build
- **SAST**: Static analysis on PR
- **Dependency Review**: On every dependency change

### 5.3 Secret Management

- ❌ No secrets in code
- ❌ No secrets in git history
- ✅ Environment variables only
- ✅ Encrypted storage for sensitive data

---

## 6. Commit Standards

### 6.1 Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 6.2 Types

| Type | Description | Example |
|------|-------------|---------|
| feat | New feature | feat(ai): Add streaming support |
| fix | Bug fix | fix(auth): Resolve token refresh |
| docs | Documentation | docs(api): Update endpoint docs |
| refactor | Code change | refactor(cache): Optimize lookup |
| test | Tests | test(ai): Add unit tests |
| chore | Maintenance | chore(deps): Update dependencies |
| perf | Performance | perf(db): Optimize queries |

### 6.3 Breaking Changes

```commit
feat(api)!: Remove deprecated endpoints

BREAKING CHANGE: The `/v1/legacy` endpoint has been removed.
Use `/v2/endpoint` instead.
```

---

## 7. Semantic Versioning

### 7.1 Version Format

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### 7.2 Version Bumps

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking change | MAJOR | 1.0.0 → 2.0.0 |
| New feature | MINOR | 1.0.0 → 1.1.0 |
| Bug fix | PATCH | 1.0.0 → 1.0.1 |
| Pre-release | PRERELEASE | 1.0.0 → 1.1.0-beta.1 |

### 7.3 Release Process

1. Update CHANGELOG.md
2. Update package.json version
3. Create git tag: `git tag v1.2.3`
4. Push tag: `git push origin v1.2.3`
5. GitHub Release with changelog notes

---

## 8. Changelog Management

### 8.1 Format

Follows [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [1.2.0] - 2026-02-21

### Added
- New feature X

### Changed
- Improved feature Y

### Fixed
- Bug in feature Z

### Security
- Patched vulnerability in dependency
```

### 8.2 Categories

- **Added**: New features
- **Changed**: Changes to existing features
- **Deprecated**: Features to be removed
- **Removed**: Features removed
- **Fixed**: Bug fixes
- **Security**: Security patches

---

## 9. Pull Request Standards

### 9.1 PR Template

```markdown
## Summary
Brief description of changes.

## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Conventional commit messages
- [ ] Documentation updated
- [ ] No new warnings
- [ ] All CI checks passing
```

### 9.2 Review Requirements

| PR Type | Required Approvals | Auto-Merge |
|---------|-------------------|------------|
| Documentation | 1 | ✅ Yes |
| Bug fix | 1 | ✅ Yes |
| Feature | 2 | ❌ No |
| Breaking change | 2 | ❌ No |
| Security | 2 | ❌ No |

---

## 10. Issue Management

### 10.1 Labels

| Category | Labels |
|----------|--------|
| Priority | P0, P1, P2, P3 |
| Type | bug, enhancement, feature, docs |
| Status | needs-triage, in-progress, blocked, review |
| Area | security, performance, accessibility, ci |

### 10.2 Priority Definitions

| Priority | Response Time | Resolution Time |
|----------|---------------|-----------------|
| P0 (Critical) | 1 hour | 4 hours |
| P1 (High) | 4 hours | 24 hours |
| P2 (Medium) | 24 hours | 7 days |
| P3 (Low) | 72 hours | 30 days |

### 10.3 Issue-PR Linkage

All PRs must reference an issue:
- `Fixes #123` - Closes issue on merge
- `Related to #123` - Links without closing
- `Part of #123` - Partial implementation

---

## 11. Technical Debt Management

### 11.1 Technical Debt Types

| Type | Examples | Priority |
|------|----------|----------|
| Code Quality | `any` types, code duplication | P3 |
| Architecture | Monolithic services, circular deps | P2 |
| Testing | Low coverage, flaky tests | P2 |
| Documentation | Missing docs, outdated docs | P3 |
| Dependencies | Outdated packages, vulnerabilities | P2 |

### 11.2 Debt Reduction Policy

- **ROI Threshold**: Only address debt with positive risk-adjusted ROI
- **Opportunistic**: Fix debt when touching related code
- **Scheduled**: Allocate 20% of sprint capacity to debt reduction

---

## 12. Architecture Decision Records (ADR)

### 12.1 ADR Template

```markdown
# ADR-NNNN: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
What is the issue being addressed?

## Decision
What is the change being proposed/made?

## Consequences
What are the positive and negative outcomes?

## Alternatives Considered
What other options were evaluated?
```

### 12.2 ADR Location

```
docs/
  adr/
    0001-record-architecture-decisions.md
    0002-service-modularization-strategy.md
    ...
```

---

## 13. Monitoring & Enforcement

### 13.1 Automated Checks

- Pre-commit hooks for commit message format
- CI pipeline for quality gates
- Dependabot for dependency updates
- CodeQL for security analysis

### 13.2 Manual Reviews

- Weekly: Open issues/PRs review
- Monthly: Branch cleanup
- Quarterly: Technical debt assessment
- Annually: Security audit

---

## 14. Escalation Procedures

### 14.1 Escalation Matrix

| Issue | First Contact | Escalation | Final |
|-------|---------------|------------|-------|
| Build failure | CI Team | Tech Lead | CTO |
| Security issue | Security Team | Tech Lead | CTO |
| Production bug | On-call | Tech Lead | CTO |

### 14.2 Emergency Procedures

1. **Critical Bug**: Create hotfix branch from `main`
2. **Security Issue**: Follow security incident response
3. **CI Failure**: Block all merges until resolved

---

## 15. Compliance & Auditing

### 15.1 Audit Trail

- All changes via PR only
- All PRs require approval
- All merges tracked in git history
- All releases tagged

### 15.2 Compliance Checks

| Requirement | Frequency | Automated |
|-------------|-----------|-----------|
| Security scan | Every build | ✅ |
| License check | Every build | ✅ |
| Code quality | Every build | ✅ |
| Dependency audit | Daily | ✅ |
| Full governance review | Weekly | ❌ |

---

## 16. Appendix

### 16.1 Quick Reference Commands

```bash
# Create feature branch
git checkout -b feat/my-feature-123

# Run all quality checks
npm run build && npm run lint && npm run typecheck && npm run test:run

# Create conventional commit
git commit -m "feat(scope): Add new feature"

# Check for vulnerabilities
npm audit

# Update dependencies
npm update && npm audit fix
```

### 16.2 Useful Links

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

**Document Owner**: Repository Manager Agent
**Review Cycle**: Quarterly
**Next Review**: 2026-05-21
