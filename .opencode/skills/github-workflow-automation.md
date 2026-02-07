# GitHub Workflow Automation Skill for QuanForge

## Trigger
Activates when managing branches, PRs, or CI/CD workflows.

## Purpose
Automate and standardize GitHub workflow for consistent development practices.

## Branch Strategy

### Main Branches
- `main`: Production-ready code
- `develop`: Integration branch for features
- `agent-workspace`: Automated agent work branch

### Feature Branches
- `feature/[description]`: New features
- `fix/[description]`: Bug fixes
- `docs/[description]`: Documentation updates

## Workflow Automation

### 1. Starting New Work
```bash
# Ensure on latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/description

# Or use agent workspace
git checkout agent-workspace
git merge origin/main
```

### 2. Commit Standards
```
[type]: [description]

[body with details]

Fixes #[issue]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `security`: Security fix

### 3. PR Creation
```bash
# Push branch
git push origin feature/description

# Create PR (using gh CLI)
gh pr create --title "feat: [description]" \
  --body "## Summary
- [Change 1]
- [Change 2]

## Testing
- [Test 1]
- [Test 2]

## Checklist
- [ ] Build passes
- [ ] Tests pass
- [ ] Documentation updated"
```

### 4. PR Review Process
- Automated checks must pass
- At least 1 review approval
- No merge conflicts
- Squash and merge preferred

## /ulw-loop Command

### Purpose
Automate the full PR lifecycle:
1. Commit changes
2. Push to `agent-workspace`
3. Create/update PR to `main`
4. Monitor checks
5. Merge on success

### Usage
```
/ulw-loop
```

### What It Does
1. **Commit**: Stages and commits all changes
2. **Push**: Pushes to `agent-workspace` branch
3. **PR**: Creates PR if none exists, updates if exists
4. **Monitor**: Waits for CI checks
5. **Merge**: Merges if all checks pass

### Requirements
- Clean working directory (or auto-commit)
- Valid opencode.json configuration
- GitHub CLI configured
- Write access to repository

## CI/CD Integration

### Pre-Merge Checks
```yaml
# Required checks
- build
- typecheck
- test
- lint
- security-audit
```

### Auto-Merge Conditions
- All checks pass
- No conflicts with main
- PR is not draft
- Required reviews approved

## Handling Failures

### Build Failures
1. Check error logs
2. Fix locally
3. Push fix
4. Re-run /ulw-loop

### Merge Conflicts
1. Pull latest main
2. Resolve conflicts
3. Commit resolution
4. Push and re-run

### Check Failures
1. Identify failing check
2. Fix root cause
3. Verify locally
4. Push and re-run

## References
- Based on sulhi-sabil/agent-skill GitHub workflow
- Adapted for QuanForge's repository structure
