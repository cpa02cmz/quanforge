# Writing Plans Skill for QuanForge

## Trigger
Activates after design approval and before implementation.

## Purpose
Create detailed implementation plans with bite-sized tasks that junior engineers can follow.

## Plan Structure

### 1. Overview
- **Goal**: What we're building
- **Scope**: What's included/excluded
- **Success Criteria**: How we know it's done

### 2. Task Breakdown
Each task must have:
- **Duration**: 2-5 minutes estimated
- **Exact File Paths**: Specific files to modify
- **Complete Code**: Full implementation (not snippets)
- **Verification Steps**: How to test

### 3. Dependencies
- Which tasks must complete before others
- External dependencies (APIs, libraries)
- Blocking issues

### 4. Testing Strategy
- Unit tests for each component
- Integration test plan
- Manual verification checklist

## Task Template
```markdown
### Task [N]: [Brief Description]
**Files**: `path/to/file1.ts`, `path/to/file2.ts`
**Duration**: ~3 minutes

**Implementation**:
```typescript
// Complete code here
```

**Verification**:
- [ ] Test passes: `npm test -- path/to/test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Feature works manually
```

## QuanForge-Specific Guidelines

### For Code Generation Features
- Ensure AI service integration
- Validate MQL5 output format
- Test with multiple strategy types

### For UI Components
- Follow accessibility guidelines
- Ensure responsive design
- Add error boundaries

### For Database Operations
- Include migration scripts
- Test with mock data
- Verify rollback strategy

### For Performance Optimizations
- Measure before/after
- Target specific metrics
- Ensure no regressions

## Example: Adding New Strategy Type

```markdown
### Task 1: Update Strategy Types
**Files**: `types.ts`, `constants/strategyTypes.ts`
**Duration**: ~2 minutes

Add new strategy type definition and constants.

### Task 2: Create Strategy Generator
**Files**: `services/strategyGenerators/newStrategy.ts`
**Duration**: ~5 minutes

Implement code generation logic for new strategy.

### Task 3: Add UI Components
**Files**: `components/StrategyConfig/NewStrategyConfig.tsx`
**Duration**: ~4 minutes

Create configuration UI for new strategy type.

### Task 4: Write Tests
**Files**: `services/strategyGenerators/newStrategy.test.ts`
**Duration**: ~3 minutes

Add unit tests for code generation.

### Task 5: Update Documentation
**Files**: `docs/STRATEGY_GUIDE.md`
**Duration**: ~2 minutes

Document the new strategy type for users.
```

## Plan Review Checklist
- [ ] All tasks < 5 minutes
- [ ] Exact file paths specified
- [ ] Complete code provided
- [ ] Dependencies mapped
- [ ] Testing strategy defined
- [ ] Success criteria clear

## References
- Based on obra/superpowers writing-plans skill
- Adapted for QuanForge development workflow
