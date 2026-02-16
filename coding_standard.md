# QuantForge AI Coding Standards

## 1. General Principles

*   **KISS (Keep It Simple, Stupid)**: Avoid over-engineering. Solves the problem at hand with the simplest standard solution.
*   **DRY (Don't Repeat Yourself)**: Extract common logic into helper functions or hooks.
*   **SRP (Single Responsibility Principle)**: Components should do one thing well.
*   **Safety First**: Always handle errors explicitly, especially with JSON parsing and API calls.

## 2. TypeScript & React

*   **Functional Components**: Use `React.FC<Props>` for all components.
*   **Hooks**: Extract complex state logic (effects, large reducers) into custom hooks (e.g., `useGeneratorLogic`).
*   **Types**:
    *   Define interfaces in `types.ts` if shared across multiple files.
    *   Use explicit types instead of `any` whenever possible.
    *   Enum values should be UPPER_CASE (e.g., `MessageRole.USER`).
*   **Naming**:
    *   Components: `PascalCase` (e.g., `CodeEditor.tsx`).
    *   Functions/Variables: `camelCase` (e.g., `handleSave`, `isLoading`).
    *   Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_SETTINGS`).

## 3. Styling (Tailwind CSS)

*   **Dark Mode**: The application is "Dark Mode First". Use specific color tokens defined in `tailwind.config` in `index.html`.
*   **Colors**:
    *   Use `bg-dark-bg` for main backgrounds.
    *   Use `bg-dark-surface` for cards/panels.
    *   Use `border-dark-border` for separators.
    *   Use `text-brand-400` or `500` for primary accents.
*   **Structure**: Use Flexbox (`flex`, `flex-col`) for layouts. Avoid absolute positioning unless necessary (e.g., overlays).

## 4. State Management

*   **Local State**: Use `useState` for UI-specific toggles (modals, tabs).
*   **Global State**: Use React Context only for global singletons (`ToastProvider`, `AuthProvider`).
*   **Data Persistence**: All critical data (`Robots`, `Settings`) must be persisted to LocalStorage (via `mockDb` or `settingsManager`) to survive page reloads.

## 5. Security

*   **API Keys**: Never hardcode keys in the source. Use `process.env` or user input stored in LocalStorage.
*   **Output Sanitization**: When rendering AI output, ensure HTML/Scripts are not executed. (The app uses simple text rendering or specific markdown parsers, avoiding `dangerouslySetInnerHTML` where possible).

## 6. AI Prompt Engineering

*   **System Prompts**: Defined in `constants.ts`.
*   **Constraints**: Prompts must explicitly enforce "Complete Code" to prevent "Lazy Coding" (e.g., `// ... rest of logic`).
*   **Context**: Always strip duplicate/redundant history before sending to the LLM to save tokens.

## 7. Service Architecture Patterns

This section defines standardized patterns for service implementation to ensure consistency across the 167+ service files in the codebase.

### 7.1 Service Export Patterns

Choose the appropriate pattern based on the service's responsibility:

#### Pattern A: Class + Singleton (Stateful Services)

**Use for**: Services with internal state (caching, monitoring, connection management)

```typescript
// Service definition
export class ServiceName {
  private cache: Map<string, any> = new Map();
  private config: ServiceConfig;

  constructor(config?: ServiceConfig) {
    this.config = config ?? DEFAULT_CONFIG;
  }

  public async doSomething(): Promise<Result> {
    // Implementation
  }
}

// Singleton instance for application-wide use
export const serviceName = new ServiceName();
```

**Examples**: `advancedCache.ts`, `tokenBudgetManager.ts`, `connectionPool.ts`

#### Pattern B: Singleton Only (Internal Classes)

**Use for**: Services where direct instantiation should be discouraged

```typescript
// Internal class (not exported)
class InternalService {
  private state: InternalState;

  constructor() {
    this.state = initializeState();
  }

  public method(): void {
    // Implementation
  }
}

// Only export the singleton instance
export const internalService = new InternalService();
```

**Examples**: `analyticsCollector.ts`, `monitoringService.ts`

#### Pattern C: Pure Functions (Stateless Utilities)

**Use for**: Stateless utility functions (deduplication, throttling, data transformation)

```typescript
// Export individual functions
export function deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Implementation
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  // Implementation
}

export function transformData(input: InputType): OutputType {
  // Implementation
}
```

**Examples**: `apiDeduplicator.ts`, `inputSanitizer.ts`, `dataTransformers.ts`

#### Pattern D: Facade with Internal Instance (Complex Operations)

**Use for**: Services that need clean public APIs but complex internal state management

```typescript
// Internal implementation
class ComplexService {
  private connections: Connection[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    // Complex initialization logic
    this.isInitialized = true;
  }

  async performOperation(params: OperationParams): Promise<Result> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    // Implementation
  }
}

const complexService = new ComplexService();

// Clean public API - hides internal complexity
export async function performOperation(params: OperationParams): Promise<Result> {
  return complexService.performOperation(params);
}

export async function initializeService(): Promise<void> {
  return complexService.initialize();
}
```

**Examples**: `gemini.ts`, `supabase.ts`, `marketData.ts`

### 7.2 Naming Conventions

*   **Classes**: `PascalCase` (e.g., `TokenBudgetManager`, `CacheService`)
*   **Singleton Instances**: `camelCase` matching the service name (e.g., `tokenBudgetManager`, `cacheService`)
*   **Function Exports**: `camelCase` descriptive verbs (e.g., `deduplicateRequest`, `sanitizeInput`)
*   **Files**: `camelCase.ts` for consistency (e.g., `apiDeduplicator.ts`, `tokenBudgetManager.ts`)

### 7.3 Anti-Patterns to Avoid

❌ **Default Exports**: Never use `export default` for services

```typescript
// BAD
export default class SomeService { }

// GOOD
export class SomeService { }
export const someService = new SomeService();
```

❌ **Mixed Responsibilities**: Don't combine stateful and stateless patterns in one file

```typescript
// BAD - mixing patterns
export class DataService { }
export function utilityFunction() { }
export const dataService = new DataService();

// GOOD - separate concerns
// In dataService.ts
export class DataService { }
export const dataService = new DataService();

// In dataUtils.ts
export function utilityFunction() { }
```

❌ **Inconsistent Naming**: Don't use different naming conventions within the same service type

```typescript
// BAD
export class CacheManager { }
export const Cache_Service = new CacheManager(); // Inconsistent

// GOOD
export class CacheManager { }
export const cacheManager = new CacheManager(); // Consistent
```

### 7.4 Testing Patterns

#### Testing Class + Singleton Services

```typescript
import { ServiceName, serviceName } from './serviceName';

describe('ServiceName', () => {
  // Test the class directly for custom configurations
  it('should allow custom configuration', () => {
    const customService = new ServiceName({ timeout: 5000 });
    expect(customService.config.timeout).toBe(5000);
  });

  // Test the singleton instance
  it('should perform operations using singleton', async () => {
    const result = await serviceName.doSomething();
    expect(result).toBeDefined();
  });

  // Reset state between tests if needed
  afterEach(() => {
    serviceName.reset(); // If reset method exists
  });
});
```

#### Testing Pure Function Services

```typescript
import { deduplicate, throttle } from './utils';

describe('utils', () => {
  describe('deduplicate', () => {
    it('should deduplicate concurrent requests', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const key = 'test-key';

      const [result1, result2] = await Promise.all([
        deduplicate(key, fn),
        deduplicate(key, fn),
      ]);

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1); // Only called once
    });
  });
});
```

#### Testing Facade Services

```typescript
import { performOperation, initializeService } from './complexService';

describe('complexService', () => {
  it('should initialize on first use', async () => {
    const result = await performOperation({ id: 'test' });
    expect(result).toBeDefined();
  });

  it('should handle initialization errors', async () => {
    await expect(initializeService()).resolves.not.toThrow();
  });
});
```

### 7.5 Migration Guide

When refactoring existing services:

1. **Identify the pattern** the service currently uses
2. **Choose the correct target pattern** based on responsibility (stateful vs stateless)
3. **Update exports** to match the chosen pattern
4. **Update imports** in consuming files (search/replace)
5. **Add tests** following the appropriate testing pattern
6. **Update documentation** if the service has public API surface

### 7.6 Service Directory Organization

```
services/
├── cache/              # Caching services (Pattern A/B)
│   ├── advancedCache.ts
│   └── lruCache.ts
├── ai/                 # AI-related services (Pattern A/D)
│   ├── AICore.ts
│   ├── aiCacheManager.ts
│   └── RateLimiter.ts
├── utils/              # Utility functions (Pattern C)
│   ├── deduplicator.ts
│   └── sanitizer.ts
├── core/               # Core services (Pattern A/B)
│   ├── DIContainer.ts
│   └── errorHandler.ts
└── index.ts            # Re-export all services
```

### 7.7 Related Documentation

*   `docs/SERVICE_ARCHITECTURE.md` - Comprehensive service layer documentation
*   `docs/api-specialist.md` - API integration patterns
*   Issue #795 - Service Layer Interface Pattern Inconsistency (resolved by this standard)
