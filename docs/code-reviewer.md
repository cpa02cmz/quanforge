# Code Reviewer Guide

## Overview

This document serves as a guide for code reviewers working on the QuantForge AI project. It outlines the code review process, standards, and common issues to watch for.

## Role & Responsibilities

As a code reviewer, your responsibilities include:

1. **Ensuring Code Quality** - Verify that code follows project standards
2. **Catching Bugs Early** - Identify potential bugs and edge cases
3. **Maintaining Consistency** - Ensure code style and patterns are consistent
4. **Security Review** - Check for security vulnerabilities
5. **Performance Review** - Identify performance issues
6. **Documentation** - Ensure code is properly documented

## Code Review Process

### Before Review

1. **Pull Latest Changes** - Ensure you're reviewing the most recent code
2. **Run Tests** - Verify all tests pass
3. **Check Build** - Ensure the project builds successfully
4. **Review Context** - Understand the purpose of the changes

### During Review

1. **Check for TypeScript Errors**
   ```bash
   npm run typecheck
   ```

2. **Verify Build Success**
   ```bash
   npm run build
   ```

3. **Run Linting**
   ```bash
   npm run lint
   ```

4. **Run Tests**
   ```bash
   npm run test:run
   ```

### Common Issues to Check

#### TypeScript Issues

- **Unused Variables** - Check for variables declared but never used
- **Type Safety** - Ensure proper typing, avoid `any` where possible
- **Null/Undefined Checks** - Verify optional values are handled
- **Promise Handling** - Ensure async/await is used correctly

#### Code Style

- **Naming Conventions** - camelCase for variables/functions, PascalCase for classes
- **File Organization** - Keep related code together
- **Import Order** - Group imports logically (external, internal, types)
- **Function Length** - Keep functions focused and reasonably sized

#### Security

- **Input Validation** - Validate all user inputs
- **XSS Prevention** - Check for proper sanitization
- **Secrets** - Ensure no hardcoded secrets or API keys
- **Dependencies** - Review new dependencies for security

#### Performance

- **Unnecessary Rerenders** - Check React component optimization
- **Memory Leaks** - Verify cleanup in useEffect
- **Bundle Size** - Be mindful of adding large dependencies
- **Async Operations** - Proper loading and error states

## Review Checklist

### TypeScript & Type Safety
- [ ] No TypeScript compilation errors
- [ ] Proper type annotations on function parameters and returns
- [ ] No implicit `any` types
- [ ] Optional chaining used appropriately (`?.`)
- [ ] Null checks for potentially undefined values

### Code Quality
- [ ] Functions have single responsibility
- [ ] Variable names are descriptive
- [ ] No unused imports or variables
- [ ] No console.log statements in production code (use logger utility)
- [ ] Error handling is comprehensive

### Testing
- [ ] New code has unit tests
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Edge cases are covered
- [ ] All tests pass

### Documentation
- [ ] Complex logic has comments explaining "why"
- [ ] Public APIs have JSDoc comments
- [ ] README is updated if needed
- [ ] Code-relevant documentation is updated

### React/Frontend Specific
- [ ] Components are properly typed
- [ ] Hooks dependencies are correct
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Responsive design considerations
- [ ] Loading and error states handled

## Common Bug Patterns

### TypeScript Errors

#### 1. Unused Variables (TS6133)
```typescript
// Bad
const unusedVar = 'value';

// Good
const usedVar = 'value';
console.log(usedVar);

// Or prefix with underscore if intentionally unused
const _unusedVar = 'value';
```

#### 2. Possibly Undefined (TS2532, TS18048)
```typescript
// Bad
const value = array[index].property;

// Good
const item = array[index];
if (item) {
  const value = item.property;
}

// Or use optional chaining
const value = array[index]?.property;
```

#### 3. Type Assignment Errors (TS2322, TS2345)
```typescript
// Bad
const str: string = undefinedValue;

// Good
const str: string = undefinedValue || '';

// Or handle undefined case
if (undefinedValue) {
  const str: string = undefinedValue;
}
```

### Security Issues

#### 1. XSS Vulnerabilities
- Always sanitize user input before rendering
- Use DOMPurify for HTML content
- Avoid dangerouslySetInnerHTML unless necessary

#### 2. Injection Attacks
- Validate and sanitize all inputs
- Use parameterized queries
- Never concatenate user input into SQL/SOQL

#### 3. Exposed Secrets
- Never commit API keys or secrets
- Use environment variables
- Check for accidental commits in reviews

## Tools & Commands

### Essential Commands

```bash
# Type checking
npm run typecheck

# Build verification
npm run build

# Linting
npm run lint
npm run lint:fix  # Auto-fix issues

# Testing
npm run test:run
npm run test:coverage

# Bundle analysis
npm run build:analyze
```

### Review Tools

- **ESLint** - Static code analysis
- **TypeScript** - Type checking
- **Vitest** - Unit testing
- **Vite** - Build tool with HMR

## Best Practices

### 1. Be Constructive
- Focus on the code, not the person
- Explain the "why" behind suggestions
- Offer solutions, not just criticisms

### 2. Prioritize Issues
- **Blockers**: Security issues, broken builds
- **High**: Type errors, test failures
- **Medium**: Code style, minor optimizations
- **Low**: Formatting, nitpicks

### 3. Know When to Approve
- Not every issue needs to be fixed
- Distinguish between "must fix" and "nice to have"
- Approve with comments for minor issues

### 4. Follow Up
- Check if requested changes were made
- Verify fixes address the root cause
- Re-review when significant changes are made

## Code Review Workflow

1. **Create Branch** from main
   ```bash
   git checkout -b code-reviewer/fix-issues
   ```

2. **Make Changes** - Fix identified issues

3. **Verify Changes**
   ```bash
   npm run typecheck
   npm run build
   npm run lint
   npm run test:run
   ```

4. **Update Documentation**
   - Update bug.md to mark fixed issues
   - Update code-reviewer.md with new patterns

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "fix: resolve TypeScript errors in services

   - Fixed unused variable errors (TS6133)
   - Fixed possibly undefined errors (TS2532)
   - Fixed type assignment errors (TS2322)
   - Updated bug.md to mark resolved issues"
   ```

6. **Push and Create PR**
   ```bash
   git push origin code-reviewer/fix-issues
   gh pr create --title "Fix TypeScript errors" --body "..."
   ```

## Recent Fixes (Example)

### 2026-02-07 - Build Warning Fixes (Code Reviewer)

Fixed dynamic import warning in `services/enhancedSupabasePool.ts`:

**Issue**: Module `dynamicSupabaseLoader.ts` was both dynamically imported and statically imported across different files, causing build warning.

**Solution**:
- Added static import at top of file
- Removed dynamic import statement
- Maintains same functionality while eliminating warning

**Pattern**: When a module is imported both statically and dynamically, standardize on one approach for better bundle optimization.

### 2026-02-07 - Lint Error Fixes (Code Reviewer)

Fixed 32 ESLint errors across 4 files:

#### Files Fixed

1. **services/securityManager.ts**
   - Fixed unnecessary escape characters in regex (lines 466, 613)
   - Removed escapes: `\(`, `\)`, `\[`, `\]`, `\{`, `\}`, `\.`, `\,`, `\;`, `\:`, `\+`, `\*`, `\/`, `\=`, `\>`, `\<`, `\!`, `\&`, `\|`, `\^`, `\~`, `\%`
   - Inside character classes `[]`, most special characters don't need escaping
   - Fixed prototype method access: `obj.hasOwnProperty(key)` → `Object.prototype.hasOwnProperty.call(obj, key)`

2. **services/enhancedSecurityManager.ts**
   - Fixed unnecessary escape characters: `\%` → `%` (lines 162, 163, 583)
   - Added eslint-disable comment for intentional null byte check (line 556)
   - Security patterns for Unicode right-to-left override and zero-width space

3. **services/predictiveCacheStrategy.ts**
   - Removed unnecessary try/catch wrapper (line 410)
   - The catch block only re-threw the error, providing no value

4. **services/resilientMarketService.ts**
   - Fixed empty catch block (line 55)
   - Added explanatory comment for intentionally ignored errors

#### ESLint Rules Applied

- **no-useless-escape**: Removed unnecessary backslash escapes in regex patterns
- **no-useless-catch**: Eliminated try/catch blocks that only re-throw errors
- **no-empty**: Added comments to intentionally empty catch blocks
- **no-control-regex**: Added disable comments for security-related null byte checks
- **no-prototype-builtins**: Used Object.prototype.hasOwnProperty.call() instead of direct method access

### 2026-02-07 - TypeScript Error Fixes

Fixed the following TypeScript errors:

#### Services Fixed

1. **integrationHealthMonitor.ts**
   - Fixed unused variables (classifyError, config, key)
   - Fixed possibly undefined string assignment issues
   - Updated getAllHealthStatuses to handle split results safely

2. **integrationWrapper.ts**
   - Removed unused FallbackOptions import

3. **queryBatcher.ts**
   - Fixed potentially undefined array access
   - Fixed unused variables (table, query, totalTime, id)
   - Fixed type issues with Supabase query builder
   - Fixed string | undefined assignment errors

4. **queryOptimizer.ts**
   - Removed unused cacheHitRate variable

5. **readReplicaManager.ts**
   - Fixed unused bestRegion variable

6. **realTimeUXScoring.ts**
   - Fixed possibly undefined lastEntry access

7. **edgeCacheManager.ts**
   - Fixed multiple unused variables (varyKey, region, action, tier, keys)
   - Fixed getFromEdgeCache and predictiveCacheWarming usage
   - Fixed type assignment in array filter

8. **edgeRequestCoalescer.ts**
   - Fixed unused timeout and key variables

9. **edgeSupabaseClient.ts**
   - Fixed type issue in results array
   - Fixed unused query and parseQuery parameters
   - Fixed string | undefined assignment

10. **fallbackStrategies.ts**
    - Fixed unused getConfig import
    - Fixed unused integrationType and metrics variables

### Verification

- ✅ TypeScript compilation: Zero errors
- ✅ Build: Successful (12.30s)
- ✅ Tests: All passing
- ✅ Lint: Warnings only (no errors from our changes)

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Best Practices](https://react.dev/learn)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Project README](./README.md)
- [Bug Tracker](./docs/bug.md)

---

**Note**: This document should be updated regularly as new patterns and issues are discovered during code reviews.
