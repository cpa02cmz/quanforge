# Backend Engineer Documentation

## Overview

This document serves as a guide for backend engineers working on the QuantForge AI project. It includes coding standards, common issues, and best practices specific to the backend services and data layer.

## Tech Stack

- **Framework**: Client-side services with Supabase integration
- **Database**: Supabase (PostgreSQL) with localStorage fallback
- **Build Tool**: Vite 6.4.1
- **Language**: TypeScript with strict mode
- **Testing**: Vitest with comprehensive test coverage
- **Linting**: ESLint with TypeScript support

## Project Structure

```
services/                  # Backend services and business logic
├── database/             # Database operations and client
│   ├── client.ts         # Supabase client with fallback
│   ├── operations.ts     # CRUD operations for robots
│   └── monitoring.ts     # Database performance monitoring
├── gemini.ts             # AI code generation service
├── supabase.ts           # Main Supabase adapter
├── mockImplementation.ts # Mock mode with localStorage
├── simulation.ts         # Monte Carlo simulation engine
├── marketData.ts         # Real-time market data service
├── securityManager.ts    # Security and validation utilities
├── backendOptimizer.ts   # Backend optimization service
├── databaseOptimizer.ts  # Database query optimization
└── index.ts              # Service exports and resilient wrappers
```

## Common Issues & Solutions

### 1. Console Statements in Production

**Issue**: Console statements in services cause lint warnings and potential performance issues in production

**Solution**: Use the logger utility with environment checks

**Example**:
```typescript
// ❌ Bad - Direct console usage
console.warn('Health check failed:', error);
console.log('Suggested optimization:', data);

// ✅ Good - Use logger utility
import { createScopedLogger } from '../utils/logger';
const logger = createScopedLogger('BackendOptimizer');

logger.warn('Health check failed:', error);
logger.log('Suggested optimization:', data);
```

### 2. Unused Variables in Services

**Issue**: ESLint errors for unused variables in catch blocks or function parameters

**Solution**: Prefix unused variables with underscore or remove them

**Example**:
```typescript
// ❌ Bad
} catch (error) {
  // Error ignored
}

// ✅ Good
} catch (_error) {
  // Error intentionally ignored
}
```

### 3. Type `any` Usage in Database Operations

**Issue**: Using `any` type bypasses TypeScript type checking in database queries

**Solution**: Use proper types or generic types with constraints

**Example**:
```typescript
// ❌ Bad
async executeBatchOperation<T>(
  client: SupabaseClient,
  operations: Array<() => Promise<T>>,
): Promise<T[]>

// ✅ Good - Use proper typing
async executeBatchOperation<T extends Record<string, unknown>>(
  client: SupabaseClient,
  operations: Array<() => Promise<T>>,
): Promise<T[]>
```

### 4. Missing Error Handling in Async Operations

**Issue**: Unhandled promise rejections in async database operations

**Solution**: Always wrap async operations in try-catch blocks

**Example**:
```typescript
// ❌ Bad
const result = await client.from('robots').select('*');

// ✅ Good
try {
  const { data, error } = await client.from('robots').select('*');
  if (error) throw error;
  return data;
} catch (error) {
  logger.error('Failed to fetch robots:', error);
  throw error;
}
```

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:run

# Bundle analysis
npm run build:analyze
```

## Code Quality Standards

### ESLint Rules Applied
- `no-console`: No console statements in production code (use logger utility)
- `@typescript-eslint/no-explicit-any`: Avoid using `any` type
- `@typescript-eslint/no-unused-vars`: No unused variables
- `@typescript-eslint/no-floating-promises`: Handle all promises

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- Strict null checks
- No unused locals/parameters

## Backend Service Patterns

### 1. Singleton Pattern
Most backend services use singleton pattern for state management:

```typescript
class BackendOptimizer {
  private static instance: BackendOptimizer;
  
  static getInstance(): BackendOptimizer {
    if (!BackendOptimizer.instance) {
      BackendOptimizer.instance = new BackendOptimizer();
    }
    return BackendOptimizer.instance;
  }
}

export const backendOptimizer = BackendOptimizer.getInstance();
```

### 2. Adapter Pattern
Database services use adapter pattern for persistence layer abstraction:

```typescript
// services/supabase.ts adapts between Supabase and localStorage
export const db = {
  async getRobots() {
    if (isMockMode) {
      return localStorage.getItem('robots');
    }
    return supabaseClient.from('robots').select('*');
  }
};
```

### 3. Resilience Pattern
All external integrations use resilience patterns:

```typescript
// From services/resilientDbService.ts
export const resilientDbService = {
  async executeWithResilience<T>(
    operation: () => Promise<T>,
    options?: ResilienceOptions
  ): Promise<T> {
    // Circuit breaker, retry logic, fallback
  }
};
```

## Database Best Practices

### 1. Query Optimization
- Use specific field selection instead of `*`
- Implement pagination for large datasets
- Use query caching for frequently accessed data
- Batch operations when possible

### 2. Error Handling
- Always check for database errors
- Provide meaningful error messages
- Implement fallback strategies
- Log errors for debugging

### 3. Security
- Validate all inputs before database operations
- Use parameterized queries (Supabase handles this)
- Sanitize search terms
- Implement rate limiting

## Performance Best Practices

1. **Request Deduplication**: Use `backendOptimizer.executeWithDeduplication()` for identical requests
2. **Query Caching**: Enable query caching in database optimizer
3. **Batch Operations**: Group database operations into batches
4. **Connection Pooling**: Use Supabase connection pooling
5. **Lazy Loading**: Load data only when needed

## Testing Guidelines

1. Write unit tests for all service methods
2. Mock external dependencies (Supabase, APIs)
3. Test error handling paths
4. Use AAA pattern (Arrange, Act, Assert)
5. Run tests before committing: `npm run test:run`

## Common Backend Bugs

### Bug: Console Statements in backendOptimizer.ts
**Location**: services/backendOptimizer.ts lines 102, 346, 435
**Fix**: Replace console.warn/console.log with logger utility

### Bug: Console Statements in databaseOptimizer.ts
**Location**: services/databaseOptimizer.ts lines 355, 390, 418, 449, 493, 529, 540, 550
**Fix**: Replace console statements with logger utility

### Bug: Unused Imports
**Location**: Various service files
**Fix**: Remove unused imports or use underscore prefix

## Deployment Checklist

Before deploying, ensure:
- [ ] Build passes: `npm run build`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: `npm run test:run`
- [ ] No console statements in production code
- [ ] All database migrations applied
- [ ] Environment variables configured

## Development Workflow

1. Create feature branch from `main`
2. Make changes following coding standards
3. Run build, lint, and tests
4. Commit with descriptive messages
5. Push branch and create PR
6. Ensure CI passes before merging

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Service Architecture](./SERVICE_ARCHITECTURE.md)
- [Bug Tracker](./bug.md)
