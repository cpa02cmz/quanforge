# Test-Driven Development Skill for QuanForge

## Trigger
Activates during implementation of new features or bug fixes.

## Purpose
Enforce RED-GREEN-REFACTOR cycle to ensure code quality and testability.

## RED-GREEN-REFACTOR Cycle

### 1. RED: Write Failing Test
```
- Write test for desired behavior
- Watch it fail (compile/type errors OK)
- Commit: "RED: [feature] - [test description]"
```

### 2. GREEN: Make It Pass
```
- Write minimal code to pass test
- No refactoring yet
- Watch it pass
- Commit: "GREEN: [feature] - [minimal implementation]"
```

### 3. REFACTOR: Clean Up
```
- Improve code quality
- Maintain green tests
- Commit: "REFACTOR: [feature] - [refactoring description]"
```

## Anti-Patterns to Avoid
- ❌ Writing code before tests
- ❌ Tests that don't fail first
- ❌ Multiple assertions per test
- ❌ Testing implementation details
- ❌ Brittle tests that break easily

## Testing Priorities for QuanForge

### Critical Paths (Test First)
1. **Code Generation**: AI service produces valid MQL5
2. **Backtesting**: Simulation runs correctly
3. **Authentication**: User sessions secure
4. **Data Persistence**: Robot saves/loads properly

### Service Layer Testing
- Supabase integration
- Market data fetching
- Performance monitoring

### Utility Testing
- Validation functions
- Security utilities
- Helper functions

## TypeScript Testing Guidelines
```typescript
// Good: Test behavior, not implementation
test('should generate valid MQL5 code for RSI strategy', () => {
  const result = generateStrategy({ type: 'RSI', period: 14 });
  expect(result.code).toContain('iRSI');
  expect(result.valid).toBe(true);
});

// Bad: Testing implementation details
test('should call generateCode 3 times', () => {
  // Don't test call counts
});
```

## References
- Based on obra/superpowers TDD skill
- Adapted for QuanForge TypeScript/Vite environment
