
# QuantForge AI - System Blueprint

This document outlines the high-level architecture, component hierarchy, and data flow of the QuantForge AI application.

## 1. System Overview

QuantForge AI is a Single Page Application (SPA) designed to democratize algorithmic trading strategy creation. It bridges the gap between natural language intention and compiled MQL5 code.

**Core Value Proposition:**
- **Natural Language Interface**: Users describe logic in English.
- **Structural Integrity**: The system ensures generated code follows MQL5 best practices (Inputs, OnInit, OnTick).
- **Immediate Feedback Loop**: Code generation, syntax highlighting, and strategy risk analysis happen in one view.

## 2. Component Hierarchy

```mermaid
graph TD
    App[App.tsx] --> AuthProvider[Supabase Auth Listener]
    App --> ToastProvider[Toast Context]
    ToastProvider --> Router[React Router]
    
    Router --> Layout[Layout.tsx]
    Layout --> Sidebar[Navigation]
    Layout --> ContentArea[Outlet]
    
    ContentArea --> Login[Auth.tsx]
    ContentArea --> Dashboard[Dashboard.tsx]
    ContentArea --> Generator[Generator.tsx]
    
    Generator --> Chat[ChatInterface.tsx]
    Generator --> Settings[StrategyConfig.tsx]
    Settings --> MarketTicker[MarketTicker.tsx]
    Generator --> Editor[CodeEditor.tsx]
    Generator --> Charts[Recharts (Pie)]
```

## 3. Key Subsystems

### A. The Generation Loop (`services/gemini.ts`)
1.  **Input**: User Prompt + Current Code State + Strategy Configuration (JSON).
2.  **Context Construction**: The service builds a prompt that enforces the configuration (Timeframe, Risk, Inputs) as "Hard Constraints" and the User Prompt as "Soft Logic".
3.  **Model Interaction**: Calls `gemini-3-pro-preview` for high-reasoning code generation.
4.  **Parsing**: A robust extraction layer identifies Markdown code blocks to separate executable code from conversational text.

### B. Persistence Layer (`services/supabase.ts`)
*   **Design Pattern**: Adapter Pattern.
*   **Behavior**:
    *   If `SUPABASE_URL` is present -> Connects to real backend.
    *   If missing -> Falls back to `localStorage` (Mock Mode).
*   **Entities**:
    *   `Robot`: Contains `code`, `strategy_params`, `chat_history`, `analysis_result`.

### C. Market Simulation (`services/marketData.ts`)
*   **Pattern**: Observer (Pub/Sub) + Singleton.
*   **Logic**:
    *   Maintains a virtual order book price for major pairs.
    *   Updates subscribers (UI components) every 1000ms.
    *   Uses Brownian motion with volatility clustering for realistic "noise".

## 4. State Management Strategy

*   **Global State**: Minimal. `Auth Session` and `Toast Notifications`.
*   **Page State**: `Generator.tsx` acts as the main controller for the specific robot being edited. It manages:
    *   `code` (String)
    *   `messages` (Array)
    *   `strategyParams` (Object)
    *   `analysis` (Object)
*   **Sync**: When "Save" is clicked, all page state is serialized and sent to the Persistence Layer.

## 5. Security & Safety

*   **API Keys**: Accessed via `process.env`.
*   **Input Sanitization**: Filenames are sanitized before download.
*   **Prompt Engineering**: System prompts prevents the AI from generating harmful or non-MQL5 content.
*   **Security Headers (2026-01-07)**: Comprehensive HTTP security headers configured in vercel.json
    - HSTS: `max-age=31536000; includeSubDomains; preload`
    - CSP: Strict Content-Security-Policy with restricted sources
    - X-Frame-Options: DENY
    - X-Content-Type-Options: nosniff
    - X-XSS-Protection: 1; mode=block
    - Permissions-Policy: Restricted device access
    - Cross-Origin Policies: require-corp, same-origin
*   **Dependency Management**: All dependencies updated to latest stable versions, 0 vulnerabilities
*   **Attack Surface Reduction**: Removed 5 unused dependencies and incompatible Next.js middleware

## 6. Deployment Considerations

### Build Compatibility
- **Cross-Platform Environment**: All code must work in browser, Node.js, and edge environments
- **Module Restrictions**: Avoid Node.js-specific modules (`crypto`, `fs`, `path`) in frontend code
- **Schema Compliance**: Platform configuration files must follow current schema requirements

### Known Issues & Solutions
- **Browser Crypto**: Replace Node.js `crypto` with browser-compatible alternatives
- **Vercel Schema**: Use minimal, schema-compliant `vercel.json` configuration
- **API Route Schema**: API route config exports must avoid unsupported properties like `regions`
- **Build Validation**: Always run build and typecheck before deployment

### Critical Technical Debt (2025-12-20 Analysis)
- **Build System**: Fixed TypeScript compilation and restored functionality  
- **Type Safety**: 905 `any` type usages creating runtime risks (priority action)
- **Maintainability**: Monolithic services limiting development velocity
- **Code Quality**: Advanced optimizations implemented, build system restored

### Performance Optimization Status (2025-12-24 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs
- **Database Optimization**: PR #132 ready with comprehensive indexing and query optimization
- **Deployment Reliability**: Optimized vercel.json pattern for consistent platform deployments
- **Pattern Framework**: Established proven Documentation-Only PR resolution pattern (6/6 successful applications)
- **Platform Independence**: Validated approach for separating code quality from platform deployment issues
- **Documentation Quality**: PR #146 establishes platform deployment pattern framework for future issues
- **Deployment Reliability**: Optimized vercel.json pattern consistently applied across all platforms
>>>>>>> 0a856d7ad185c16b1734ee5dcad5dd9be57fb580

### Code Quality Standards
- **Type Safety**: Minimize `any` usage, implement strict TypeScript
- **Modularity**: Service files should be <500 lines, well-decoupled
- **Consistency**: Unified error handling, naming conventions, patterns
- **Testing**: >80% test coverage for critical paths

### Architectural Improvements (2026-01-07)

#### Module Extraction from Monolithic Services

**Problem**: `services/supabase.ts` was 1583 lines, violating Single Responsibility Principle
**Solution**: Extracted three focused modules:

1. **services/performanceMonitoring.ts**
   - `PerformanceMonitor` class: Tracks operation metrics (count, total time, average time)
   - `EdgePerformanceTracker` class: Advanced edge metrics with percentiles
   - Exports: `performanceMonitor`, `edgePerformanceTracker` instances
   - Lines: 82

2. **services/robotIndexManager.ts**
   - `RobotIndexManager` class: Efficient robot indexing and filtering
   - Creates indexes by ID, name, type, and date
   - Rebuilds index only when data changes (change detection via data version hash)
   - Lines: 49

3. **services/mockImplementation.ts**
   - `mockAuth`: Mock authentication with localStorage persistence
   - `mockClient`: Mock database client for development/testing
   - Helper functions: `safeParse`, `trySaveToStorage`, `generateUUID`, `getMockSession`
   - Lines: 113

**Impact**:
- Original `supabase.ts`: 1583 lines → After extraction: 827 lines (47% reduction)
- Better separation of concerns: Auth, Performance, Indexing isolated from core adapter
- Improved maintainability: Each module <150 lines, focused responsibility
- Easier testing: Individual modules can be tested independently

**Architectural Pattern**: Adapter Pattern (Core) + Single Responsibility (Extracted Modules)

### Compression Utilities Extraction (2026-01-07)

**Problem**: Compression logic (compressData, decompressData, shouldCompress, estimateSize) mixed with cache management in edgeCacheManager.ts, violating Single Responsibility Principle

**Solution**: Extracted to focused module:
1. **services/edgeCacheCompression.ts** (45 lines)
   - `CompressionConfig` interface: Configuration for compression threshold
   - `EdgeCacheCompression` class: Compression utilities with public methods
   - `compress<T>(data: T): T` - Compress data using lz-string
   - `decompress<T>(data: T): T` - Decompress data using lz-string
   - `shouldCompress<T>(data: T): boolean` - Check if compression is beneficial
   - `estimateSize<T>(data: T): number` - Estimate data size for compression decision

**Impact**:
- Original `edgeCacheManager.ts`: 1209 lines → After extraction: 1182 lines (27 lines reduction)
- Better separation of concerns: Compression logic isolated from cache management
- Improved maintainability: Compression module can be tested and modified independently
- Reusable design: EdgeCacheCompression class can be used by other cache managers
- Clear interface: Public API with focused, self-documenting methods

### Data Integrity Improvements (2026-01-07)

#### TypeScript Schema Alignment
**Problem**: TypeScript `Robot` interface missing fields that exist in database schema
**Solution**: Updated `types.ts` Robot interface to align with database schema:
- Added `version: number` - Tracks robot version for versioning
- Added `is_active: boolean` - Controls active status
- Added `is_public: boolean` - Controls public sharing visibility
- Added `view_count: number` - Tracks view analytics
- Added `copy_count: number` - Tracks copy/fork analytics

**Impact**: 
- Type safety improved - frontend now has complete type coverage
- Prevents runtime errors from missing fields
- Full alignment between TypeScript types and database schema

#### Database-Level Data Validation
**Problem**: Data validation only at application level, no database enforcement
**Solution**: Created migration 003 with comprehensive database constraints:

1. **Unique Constraint**: `robots_user_name_unique` on (user_id, name)
   - Prevents duplicate robot names for same user
   - Ensures data uniqueness at database level

2. **Strategy Parameter Validation**:
   - Risk percent: 0-100 range
   - Stop loss: must be positive
   - Take profit: must be positive and greater than stop loss
   - Magic number: must be positive

3. **Backtest Settings Validation**:
   - Initial deposit: must be positive
   - Days: must be positive
   - Leverage: must be positive

4. **Analysis Result Validation**:
   - Risk score: 0-100 range
   - Profitability: -100 to 10000 range

5. **Counter Validation**:
   - View count: non-negative
   - Copy count: non-negative
   - Version: must be positive

**Impact**:
- Data integrity enforced at database level (primary enforcement layer)
- Prevents invalid data from being stored
- Application validation now has database backing
- Consistent data quality across all operations

#### Migration Safety
**Reversibility**: Migration 003 includes full down script
- All constraints can be safely removed
- Down script documented in `003_data_integrity_constraints_down.sql`
- Follows migration best practices: always reversible

**Documentation**: Comprehensive constraint comments
- Each constraint has descriptive COMMENT in database
- Clear documentation of validation rules
- Maintenance-friendly constraint management

**Data Integrity Benefits**:
- 100% type coverage for database fields
- Database-level validation prevents invalid data
- No duplicate robot names per user
- All numeric ranges validated
- Consistent counter data (no negative values)

### Storage Abstraction Layer (2026-01-08)

**Problem**: Direct localStorage access throughout codebase (133 occurrences across 22 files) with inconsistent error handling, serialization patterns, and environment checks.

**Solution**: Created comprehensive storage abstraction layer following SOLID principles:

1. **IStorage Interface** (utils/storage.ts):
   - Generic interface for storage operations (get, set, remove, clear, has, keys, size)
   - Type-safe with full TypeScript support
   - Consistent API across all storage implementations

2. **BrowserStorage Class**:
   - localStorage and sessionStorage implementations
   - Automatic JSON serialization/deserialization
   - Robust error handling with custom error types (StorageQuotaError, StorageNotAvailableError)
   - Quota management with automatic cleanup of old items
   - Environment agnostic (works in browser, SSR, and test environments)
   - Prefix support for namespacing

3. **InMemoryStorage Class**:
   - In-memory storage implementation for testing
   - Same IStorage interface for easy swapping
   - No persistence (data lost on page refresh)
   - Perfect for unit tests and mock scenarios

4. **Singleton Instances**:
   - `getLocalStorage()` - Singleton localStorage instance
   - `getSessionStorage()` - Singleton sessionStorage instance
   - `createInMemoryStorage()` - Factory for in-memory instances

**Impact**:
- Consistent API: One interface for all storage operations
- Type Safety: Full TypeScript generics support
- Error Handling: Robust, uniform error handling with proper logging
- Testing: InMemoryStorage enables easy unit testing without side effects
- Environment Support: Works in browser, SSR, and test environments
- Quota Management: Automatic cleanup when storage quota exceeded

**Storage Configuration Options**:
- `prefix`: Namespace keys (e.g., 'app_', 'user_')
- `enableSerialization`: Toggle automatic JSON serialization (default: true)
- `enableQuotaHandling`: Toggle automatic quota management (default: true)

**Next Steps** (Follow-up Task):
- Migrate existing localStorage calls to use new abstraction layer
- Target: 133 occurrences across 22 files
- Priority: High (improves maintainability and testability)
- Estimated Effort: Medium (systematic migration with minimal functional changes)

**Testing**:
- Created comprehensive test suite (utils/storage.test.ts) with 200+ tests
- Test coverage: IStorage interface, BrowserStorage, InMemoryStorage
- Edge cases: Null values, cyclic references, quota errors, special characters
- Build verification: Production build passes successfully (11.44s)
