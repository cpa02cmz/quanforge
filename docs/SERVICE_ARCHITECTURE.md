# Service Architecture - QuantForge AI

This document outlines the client-side service layer architecture for QuantForge AI, a Single Page Application (SPA) built with Vite.

## Architecture Overview

QuantForge AI is a **client-side SPA** that uses a service layer architecture for all business logic. There are **no REST API endpoints** - all data persistence, AI interactions, and market data are handled through client-side services.

### Service Layer Design

**Pattern**: Service Layer Pattern with Adapter Pattern for data persistence

**Key Characteristics**:
- All services are client-side TypeScript modules
- Supabase used directly via `@supabase/supabase-js` client library
- Mock mode fallback to localStorage for offline/demo functionality
- No server-side API routes (pure client-side application)

## Core Services

### Database & Persistence

#### `services/supabase.ts` (827 lines)
Primary adapter for data persistence with automatic mock mode fallback.

**Methods**:
- `auth`: Authentication session management with Supabase
- `robots`: CRUD operations for trading robots
- `getRobots()`: Fetch all robots with pagination support
- `saveRobot(robot)`: Save/create robot with validation
- `deleteRobot(id)`: Delete robot by ID
- `importDatabase(json)`: Import robots from JSON backup
- `exportDatabase()`: Export all robots to JSON

**Features**:
- Adapter Pattern: Switches between Supabase and localStorage automatically
- Connection retry with exponential backoff
- Automatic quota handling for localStorage
- Data validation and sanitization

**Mock Mode**: When `VITE_SUPABASE_URL` is missing, all operations use localStorage

---

### AI Code Generation

#### `services/gemini.ts` (827 lines)
AI-powered MQL5 code generation using Google Gemini API.

**Methods**:
- `generateCode(prompt, currentCode, strategyParams)`: Generate MQL5 trading code
- `analyzeStrategy(code, prompt)`: Analyze strategy risk and profitability
- `streamResponse(prompt, onChunk, onComplete)`: Stream AI responses

**Features**:
- Context-aware code generation with strategy constraints
- Markdown code block extraction from AI responses
- Token budget management for efficient API usage
- Retry logic with exponential backoff
- Support for multiple Gemini models (gemini-3-pro-preview, gemini-2.5-flash)
- DeepSeek R1 model support

**Configuration**:
- Requires `VITE_API_KEY` environment variable (Google Gemini API key)
- Custom system prompts via settings
- Configurable temperature and max tokens

---

### Market Data

#### `services/marketData.ts`
Real-time market data simulation for major forex pairs.

**Methods**:
- `subscribe(symbol, callback)`: Subscribe to market updates
- `unsubscribe(symbol)`: Unsubscribe from symbol
- `getQuote(symbol)`: Get current quote for symbol

**Features**:
- Observer Pattern (Pub/Sub) for real-time updates
- Simulated Brownian motion with volatility clustering
- Supports: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF
- Update frequency: 1000ms

---

### Settings Management

#### `services/settingsManager.ts`
Application settings persistence with localStorage.

**Methods**:
- `getSettings()`: Get all settings
- `updateSettings(settings)`: Update settings
- `resetSettings()`: Reset to defaults

**Settings Include**:
- AI provider selection (Gemini, DeepSeek, OpenAI)
- API keys with encryption
- System prompts and custom instructions
- UI preferences

---

### Strategy Simulation

#### `services/simulation.ts`
Monte Carlo simulation for strategy backtesting.

**Methods**:
- `runSimulation(strategy, iterations)`: Run Monte Carlo simulation
- `calculateEquityCurve(trades)`: Calculate equity curve
- `calculateMetrics(results)`: Calculate ROI, drawdown, Sharpe ratio

**Features**:
- Probabilistic risk modeling
- Multiple trade scenarios
- Visual equity curve generation
- Risk/return metrics

---

### Performance Monitoring

#### `services/performanceMonitorEnhanced.ts` (82 lines)
Performance metrics collection and tracking.

**Classes**:
- `PerformanceMonitor`: Track operation count, time, averages
- `EdgePerformanceTracker`: Advanced edge metrics with percentiles

**Methods**:
- `startOperation(name)`: Start tracking operation
- `endOperation(name)`: End and record operation time
- `getMetrics()`: Get all performance metrics
- `getPercentiles()`: Get P50, P95, P99 metrics

---

### Caching Layer

#### `services/edgeCacheManager.ts` (1182 lines)
Multi-tier caching system for performance optimization.

**Methods**:
- `get(key)`: Get cached value
- `set(key, value, ttl)`: Cache value with TTL
- `invalidate(pattern)`: Invalidate cache entries by pattern
- `clear()`: Clear all cache

**Features**:
- Edge-optimized caching for Vercel deployment
- Compression support via `edgeCacheCompression.ts`
- Cache invalidation strategies
- Multi-tier caching (memory, edge, database)

---

### Integration Resilience

#### `services/integrationWrapper.ts` & Resilience Modules
Unified resilience system for external integrations.

**Components**:
- `circuitBreakerMonitor`: Circuit breaker state management
- `fallbackStrategies`: Priority-based fallbacks and degraded mode
- `integrationHealthMonitor`: Health checks and metrics
- `resilientAIService`: AI service wrapper with resilience
- `resilientDbService`: Database service wrapper with resilience
- `resilientMarketService`: Market data service wrapper with resilience

**Features**:
- Automatic retry with exponential backoff
- Circuit breaker pattern to prevent cascading failures
- Graceful degradation modes
- Health monitoring and alerting
- Configurable timeouts and retry policies

---

## Security Services

### `services/securityManager.ts`
Comprehensive security utilities.

**Methods**:
- `encrypt(data)`: Encrypt sensitive data
- `decrypt(data)`: Decrypt encrypted data
- `sanitizeInput(input)`: Sanitize user input
- `validateToken(token)`: Validate authentication tokens

**Features**:
- Browser-compatible encryption (no Node.js crypto dependency)
- XSS prevention
- SQL injection prevention
- CSRF protection

---

## Utility Services

### Index Management

#### `services/robotIndexManager.ts` (49 lines)
Efficient robot indexing and filtering.

**Methods**:
- `buildIndex(robots)`: Build search index
- `search(query)`: Search robots by name, type, date
- `filter(filters)`: Filter robots by criteria

**Features**:
- Change detection via data version hash
- Index rebuilding only when data changes
- Optimized for large robot collections

---

### API Optimization

#### `services/apiDeduplicator.ts` (101 lines)
Duplicate request deduplication.

**Methods**:
- `deduplicate(key, fn)`: Deduplicate identical requests
- `clear(key)`: Clear deduplication cache

**Features**:
- Request coalescing
- Cache deduplication
- Reduces unnecessary API calls

---

## Usage Examples

### Accessing Services

```typescript
// Import services
import { db, aiService, marketData, settingsManager } from './services';

// Get all robots
const robots = await db.getRobots();

// Generate MQL5 code
const generatedCode = await aiService.generateCode(
  'Create a triple EMA crossover',
  currentCode,
  strategyParams
);

// Subscribe to market data
marketData.subscribe('EURUSD', (quote) => {
  console.log('EURUSD:', quote);
});

// Update settings
settingsManager.updateSettings({ aiProvider: 'gemini' });
```

### Using Mock Mode

```typescript
// No Supabase configuration needed
// All operations automatically use localStorage

const robots = await db.getRobots(); // Returns robots from localStorage
await db.saveRobot(robot); // Saves to localStorage
```

### Using Supabase

```typescript
// Configure environment variables
// VITE_SUPABASE_URL=your-supabase-url
// VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

// All operations automatically use Supabase
const robots = await db.getRobots(); // Fetches from Supabase
await db.saveRobot(robot); // Saves to Supabase
```

---

## Service Architecture Benefits

### 1. Offline-First Design
- Mock mode ensures functionality without backend
- localStorage provides instant data persistence
- Graceful degradation when external services unavailable

### 2. Cross-Platform Compatibility
- Pure client-side JavaScript/TypeScript
- Works in browser, Node.js, and edge environments
- No Node.js-specific dependencies in production code

### 3. Easy Testing
- All services can be tested independently
- Mock implementations for external dependencies
- No server setup required for development

### 4. Performance Optimization
- Client-side caching reduces network requests
- Request deduplication prevents duplicate calls
- Edge optimization for Vercel deployment

### 5. Security
- Client-side encryption for sensitive data
- Input sanitization prevents XSS attacks
- CSRF protection for secure operations

---

## Development Workflow

### Adding New Services

1. Create service file in `services/` directory
2. Export service from `services/index.ts`
3. Follow service layer pattern (classes or exported functions)
4. Add comprehensive JSDoc comments
5. Include error handling and logging
6. Add unit tests in `services/*.test.ts`

### Service Guidelines

- **Single Responsibility**: Each service has one clear purpose
- **Adapter Pattern**: Database services abstract persistence layer
- **Observer Pattern**: Event-driven services (market data, auth)
- **Circuit Breaker**: External integrations use resilience pattern
- **Dependency Injection**: Services accept dependencies as parameters

---

## Testing Services

```typescript
// Example test for gemini service
import { aiService } from './services/gemini';

describe('aiService', () => {
  it('should generate code', async () => {
    const code = await aiService.generateCode(
      'Create EMA crossover',
      '',
      { timeframe: 'H1', risk: 2 }
    );
    expect(code).toContain('OnInit');
  });
});
```

---

## Troubleshooting

### Issue: Supabase connection errors
**Solution**:
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Verify Supabase project is active
- Check RLS policies in Supabase dashboard
- Fallback: App automatically uses localStorage mock mode

### Issue: AI generation fails
**Solution**:
- Verify `VITE_API_KEY` is valid Google Gemini API key
- Check API quota in Google Cloud Console
- Enable correct Gemini models in API console
- Check network connectivity

### Issue: Market data not updating
**Solution**:
- Market data is simulated (not real-time)
- Check browser console for errors
- Ensure marketData.subscribe() was called correctly

---

## Performance Optimization

### Caching Strategy
- Service responses cached with configurable TTL
- Cache invalidation on data changes
- Edge caching for Vercel deployment
- Request deduplication reduces API calls

### Bundle Optimization
- Services code-split by functionality
- Tree-shaking removes unused code
- Lazy loading for heavy services
- Minimized bundle size (13s build time)

---

## Migration Guide

If migrating from previous architecture with REST API endpoints:

1. **No API endpoints**: All functionality now client-side
2. **Service imports**: Use `import { db, aiService } from './services'`
3. **Mock mode**: Automatically enabled when Supabase not configured
4. **Direct Supabase**: Uses Supabase client library directly (no custom API)
5. **Data export**: Use `db.exportDatabase()` for backups

---

## References

- **Architecture**: `docs/blueprint.md`
- **Type Definitions**: `types.ts`
- **Coding Standards**: `coding_standard.md`
- **Task Tracker**: `docs/task.md`
- **Build Configuration**: `vite.config.ts`
