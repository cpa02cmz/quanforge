# Bug Tracker

## Active Bugs

### TypeScript Errors

#### services/integrationHealthMonitor.ts
- [ ] **TS2345**: Argument type 'string | undefined' not assignable to 'string' (line 242, 375)
- [ ] **TS2322**: Type 'string | undefined' not assignable to 'string' (line 247)
- [ ] **TS6133**: 'key' declared but never read (line 257)

#### services/integrationWrapper.ts
- [ ] **TS6133**: 'FallbackOptions' declared but never read (line 14)

#### services/queryBatcher.ts
- [ ] **TS2532**: Object is possibly 'undefined' (lines 114, 390, 656)
- [ ] **TS6133**: 'table', 'query', 'totalTime', 'id' declared but never read
- [ ] **TS2339**: Property 'filter' does not exist on type (line 297)
- [ ] **TS2739**: Type missing properties from PostgrestQueryBuilder (line 303)
- [ ] **TS2322**: Type 'string | undefined' not assignable to 'string' (line 374)

#### services/queryOptimizer.ts
- [ ] **TS6133**: 'cacheHitRate' declared but never read (line 25)

#### services/readReplicaManager.ts
- [ ] **TS6133**: 'bestRegion' declared but never read (line 176)

#### services/realTimeUXScoring.ts
- [ ] **TS18048**: 'lastEntry' is possibly 'undefined' (line 171)

#### services/edgeCacheManager.ts
- [ ] **TS6133**: Multiple unused variables (varyKey, region, action, tier, getFromEdgeCache, predictiveCacheWarming, regionStats, keys)
- [ ] **TS2345**: Type '(string | null)[]' not assignable to 'string[]' (line 473)

#### services/edgeRequestCoalescer.ts
- [ ] **TS6133**: 'timeout' and 'key' declared but never read

#### services/edgeSupabaseClient.ts
- [ ] **TS2322**: Type assignment error (line 169)
- [ ] **TS6133**: 'query' and 'parseQuery' declared but never read
- [ ] **TS2345**: Argument type 'string | undefined' not assignable to 'string' (line 341)

### Build Warnings

- [ ] **Dynamic Import Warning**: services/dynamicSupabaseLoader.ts dynamically imported but also statically imported
  - File: services/enhancedSupabasePool.ts importing from edgeSupabasePool.ts, readReplicaManager.ts
  - Impact: Dynamic import will not move module into another chunk

### Test stderr Output (Non-critical, but noisy)

- [ ] **storage.test.ts**: Failed to parse stored value for key: undefined-value (SyntaxError)
- [ ] **storage.test.ts**: Failed to parse invalid JSON gracefully
- [ ] **gemini.test.ts**: Error messages logged to stderr during error handling tests (expected behavior)
- [ ] **mockImplementation.test.ts**: Storage quota exceeded message logged

## Fixed Bugs

### 2026-02-07 - PHASE 1 Bug Fixes

#### ✅ App.tsx
- [x] **TS7031**: Binding element 'session' implicitly has 'any' type (line 77)
- [x] **TS7006**: Parameter 'err' implicitly has 'any' type (line 89)
- [x] **TS7006**: Parameter '_event' implicitly has 'any' type (line 102)
- [x] **TS7006**: Parameter 'session' implicitly has 'any' type (line 102)

#### ✅ services/circuitBreakerMonitor.ts
- [x] **TS6133**: 'IntegrationType' declared but never read (line 6)
- [x] **TS6133**: 'metrics' declared but never read (line 36)
- [x] **TS6133**: 'breaker' declared but never read (line 200)
- [x] **TS6133**: 'currentStatus' declared but never read (line 210)

#### ✅ services/databaseOptimizer.ts
- [x] **TS6133**: 'robotCache' declared but never read (line 4)
- [x] **TS18048**: 'op' is possibly 'undefined' (multiple lines)
- [x] **TS6133**: 'T' declared but never read (line 296)
- [x] **TS2345**: Argument type mismatch (line 316)
- [x] **TS6133**: 'executeQuery', 'operation', 'params' declared but never read (line 358)

## Testing Status

- ✅ All 423 tests passing
- ✅ Build succeeds (15.13s)
- 🔄 TypeScript compilation: In progress (reduced from 76 errors)

## Priority

1. **HIGH**: Fix TypeScript errors blocking strict type checking
2. **MEDIUM**: Remove unused variables and parameters
3. **LOW**: Address build warnings for chunk optimization
