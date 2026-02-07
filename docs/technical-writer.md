# Technical Writer Guidelines

## Role Overview

As a Technical Writer specialist for QuantForge AI, your primary responsibility is to ensure all documentation is accurate, consistent, accessible, and up-to-date. You serve as the bridge between technical implementation and user understanding.

## Documentation Standards

### 1. File Organization

```
docs/
├── blueprint.md              # System architecture overview
├── SERVICE_ARCHITECTURE.md   # Service layer documentation
├── DATA_ARCHITECTURE.md      # Database and data integrity docs
├── INTEGRATION_RESILIENCE.md # Resilience system API docs
├── INTEGRATION_MIGRATION.md  # Migration guide for developers
├── FRONTEND_OPTIMIZER.md     # Performance optimization docs
├── SEO_ENHANCEMENT_GUIDE.md  # SEO implementation guide
├── QUICK_START.md            # End-user getting started guide
├── task.md                   # Development task tracker
├── bug.md                    # Bug tracking and fixes
├── code-reviewer.md          # Code review guidelines
├── frontend-engineer.md      # Frontend development guide
└── technical-writer.md       # This file
```

### 2. Link Conventions

**Internal Links (within docs/ folder):**
```markdown
<!-- Correct - relative to current file -->
[Service Architecture](SERVICE_ARCHITECTURE.md)
[Blueprint](blueprint.md)
[Quick Start](QUICK_START.md)

<!-- Correct - linking to parent directory -->
[README](../README.md)
[Coding Standards](../coding_standard.md)
[Contributing](../CONTRIBUTING.md)

<!-- Incorrect - don't use docs/ prefix within docs/ folder -->
~~[Service Architecture](docs/SERVICE_ARCHITECTURE.md)~~
```

**External Links:**
- Use HTTPS protocol
- Prefer official documentation
- Avoid linking to temporary resources

### 3. Common Documentation Issues to Fix

#### Issue 1: Incorrect Relative Links
**Problem:** Links in `docs/*.md` files referencing other docs files with `docs/` prefix.

**Example Fix:**
```markdown
<!-- Before (incorrect) -->
- [Service Architecture](docs/SERVICE_ARCHITECTURE.md)
- [Blueprint](docs/blueprint.md)

<!-- After (correct) -->
- [Service Architecture](SERVICE_ARCHITECTURE.md)
- [Blueprint](blueprint.md)
```

#### Issue 2: Broken Links to Parent Directory
**Problem:** Links to files in parent directory (`README.md`, `coding_standard.md`) not using `../` prefix.

**Example Fix:**
```markdown
<!-- Before (incorrect) -->
- [README](README.md)
- [Coding Standards](coding_standard.md)

<!-- After (correct) -->
- [README](../README.md)
- [Coding Standards](../coding_standard.md)
```

#### Issue 3: Outdated Information
**Problem:** Documentation referencing deleted files or outdated architecture.

**Files to NEVER reference (deleted):**
- ~~`docs/API_DOCUMENTATION.md`~~ - Deleted, replaced by `SERVICE_ARCHITECTURE.md`
- ~~`api/` directory~~ - Removed, no server-side API routes exist

#### Issue 4: Inconsistent Formatting
**Standards:**
- Use ATX-style headers (`# Header` not `Header\n===`)
- Code blocks must specify language: ```typescript not ```
- Lists should have consistent indentation (2 spaces)
- Line length: Soft wrap at 100 characters

### 4. Writing Style Guidelines

**Tone:**
- Professional but approachable
- Active voice preferred
- Second person ("you") for instructions
- Present tense for descriptions

**Accessibility:**
- Use descriptive link text (not "click here")
- Provide alt text for diagrams
- Use semantic heading hierarchy (don't skip levels)
- Include code examples for technical concepts

**Code Examples:**
- Must be tested and working
- Include imports in TypeScript examples
- Show both "before" and "after" for migrations
- Use realistic data in examples

### 5. Verification Checklist

Before submitting documentation changes:

- [ ] All internal links work (use `grep` to verify)
- [ ] No references to deleted files
- [ ] Code examples are syntax-highlighted
- [ ] Headers follow hierarchy (h1 → h2 → h3)
- [ ] No TODO/FIXME markers left in content
- [ ] Consistent terminology throughout
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors: `npm run typecheck`

### 6. Documentation Types

#### User Documentation (QUICK_START.md)
**Audience:** End users creating trading strategies
**Focus:** Step-by-step workflows, examples, safety warnings
**Style:** Instructional, encouraging, safety-conscious

#### Developer Documentation (SERVICE_ARCHITECTURE.md)
**Audience:** Developers contributing to codebase
**Focus:** Architecture patterns, API usage, implementation details
**Style:** Technical, precise, comprehensive

#### Migration Guides (INTEGRATION_MIGRATION.md)
**Audience:** Developers updating existing code
**Focus:** Before/after comparisons, step-by-step instructions
**Style:** Clear, actionable, with rollback procedures

#### Bug Documentation (bug.md)
**Audience:** Development team
**Focus:** Issue description, root cause, solution, verification
**Style:** Structured, searchable, dated entries

### 7. Maintenance Tasks

**Weekly:**
- Review task.md for documentation-related entries
- Check for broken links
- Verify code examples still work

**Monthly:**
- Update outdated screenshots/diagrams
- Review and archive completed tasks
- Check external links for availability

**On Release:**
- Update version references
- Verify all migration guides are current
- Update changelog/task.md

### 8. Special Files Reference

#### AGENTS.md
- Contains agent insights and decisions
- Documents resolution patterns
- Tracks build compatibility issues
- **Do not edit** - Append-only for agents

#### task.md
- Tracks all development tasks
- Use specific format for entries
- Mark completed tasks with [x]
- Include date and detailed description

#### ROADMAP.md
- Product roadmap and feature planning
- Update when features are completed
- Link to relevant task.md entries

### 9. Quick Fixes Reference

**Fix broken internal links:**
```bash
# Find all markdown links
grep -rn "\[.*\](.*\.md)" docs/

# Check if linked files exist
for file in $(grep -oP '\(.*?\.md\)' docs/*.md | tr -d '()' | sort -u); do
  if [ ! -f "$file" ]; then
    echo "Missing: $file"
  fi
done
```

**Verify build:**
```bash
npm run build
npm run typecheck
```

### 10. Common Patterns

**Documenting a New Feature:**
1. Add entry to task.md with [x] marker
2. Update relevant architecture docs
3. Add user-facing documentation if applicable
4. Update ROADMAP.md if feature was planned
5. Verify all cross-references work

**Fixing a Bug:**
1. Add entry to bug.md with date prefix
2. Document root cause and solution
3. Include verification steps
4. Reference related task.md entries

**Updating API Documentation:**
1. Update SERVICE_ARCHITECTURE.md for service changes
2. Update INTEGRATION_RESILIENCE.md for resilience patterns
3. Update INTEGRATION_MIGRATION.md if breaking changes
4. Verify all code examples compile

---

## Current Documentation Status

**Last Updated:** 2026-02-07

**Active Issues:**
- Fixed: QUICK_START.md internal link references
- Fixed: Relative path links to parent directory files
- Fixed: Broken references to deleted API_DOCUMENTATION.md (see Bug Fixes below)
- Fixed: Internal documentation links with incorrect `docs/` prefix (see Link Fixes below)

**Bug Fixes (2026-02-07):**
- **Issue**: Multiple documentation files referenced deleted `docs/API_DOCUMENTATION.md`
- **Files Fixed**:
  1. README.md (line 234): Replaced with `SERVICE_ARCHITECTURE.md`
  2. USER_GUIDE.md (line 389): Replaced with `SERVICE_ARCHITECTURE.md`
  3. AI_AGENT_DOCUMENTATION_INDEX.md (line 24): Replaced with `SERVICE_ARCHITECTURE.md`
  4. DOCUMENTATION_INDEX.md (lines 26, 75): Replaced with `SERVICE_ARCHITECTURE.md`
- **Impact**: All documentation links now point to existing, accurate service architecture documentation

**Documentation Link Fixes (2026-02-07):**
- **Issue**: 7 documentation files used incorrect `docs/` prefix for internal links
- **Files Fixed**:
  1. INTEGRATION_MIGRATION.md: Fixed 4 internal links
  2. SERVICE_ARCHITECTURE.md: Fixed 4 internal links  
  3. api-specialist.md: Fixed 2 internal links
  4. backend-engineer.md: Fixed 6 internal links
  5. integration-engineer.md: Fixed 3 internal links
  6. quality-assurance.md: Fixed 1 internal link
  7. reliability-engineer.md: Fixed 4 internal links
- **Pattern**: Changed `[Text](docs/FILENAME.md)` to `[Text](FILENAME.md)` for files within docs/ folder
- **Impact**: All internal documentation links now follow correct relative path conventions

**Code Quality Fixes (2026-02-07):**
- **Issue**: 4 lint errors due to unreachable code in service files
- **Files Fixed**:
  1. services/database/cacheLayer.ts: Removed unreachable catch block
  2. services/optimization/modularBackendOptimizationManager.ts: Removed unreachable catch block
  3. services/optimization/recommendationEngine.ts: Removed unreachable catch block
  4. services/supabase/index.ts: Removed unreachable catch block
- **Pattern**: Functions returning simple objects don't need try-catch wrappers
- **Impact**: Build now has 0 errors (2152 warnings remaining)

**Build Status:** ✅ Passing
- Build time: ~12s
- TypeScript: 0 errors
- Lint: 0 errors (2152 warnings)
- No broken internal links
- All documentation links follow conventions

**Documentation Coverage:**
- ✅ User Guide (QUICK_START.md)
- ✅ Architecture (blueprint.md, SERVICE_ARCHITECTURE.md)
- ✅ Data Architecture (DATA_ARCHITECTURE.md)
- ✅ Integration Patterns (INTEGRATION_RESILIENCE.md)
- ✅ Migration Guides (INTEGRATION_MIGRATION.md)
- ✅ Performance (FRONTEND_OPTIMIZER.md)
- ✅ Security (covered in blueprint.md)
- ✅ SEO (SEO_ENHANCEMENT_GUIDE.md)
- ✅ Development Guides (code-reviewer.md, frontend-engineer.md)
- ✅ Task Tracking (task.md)
- ✅ Bug Tracking (bug.md)

---

**Note:** This document should be updated whenever new documentation patterns are established or standards change.
