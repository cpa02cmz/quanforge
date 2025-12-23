
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

### Performance Optimization Status (2025-12-23 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs
- **Database Optimization**: PR #132 comprehensive optimizations ready and mergeable
  - Advanced indexing (composite, partial, full-text, JSONB)
  - Query optimization with specialized robot methods
  - Multi-tier caching with predictive preloading
  - Performance monitoring and analytics
  - Complete SQL migrations for database structure improvements
- **Deployment Reliability**: Optimized vercel.json pattern for consistent platform deployments
- **Platform Issue Resolution**: Established systematic approach for handling platform-specific deployment failures

### Code Quality Standards
- **Type Safety**: Minimize `any` usage, implement strict TypeScript
- **Modularity**: Service files should be <500 lines, well-decoupled
- **Consistency**: Unified error handling, naming conventions, patterns
- **Testing**: >80% test coverage for critical paths

### Comprehensive Codebase Analysis Results (2025-12-23)

#### Quality Assessment Scores
- **Stability**: 72/100 - Build system reliable, inconsistent error patterns
- **Performance**: 85/100 - Advanced optimization, some monitoring overhead
- **Security**: 88/100 - Comprehensive protection, one hardcoded key issue
- **Scalability**: 78/100 - Advanced pooling, service coupling risks
- **Modularity**: 45/100 - **CRITICAL**: 15+ monolithic services >500 lines
- **Flexibility**: 52/100 - **MEDIUM**: Extensive hardcoded values found
- **Consistency**: 68/100 - Good patterns, inconsistent error handling

#### Critical Issues Identified
1. **Monolithic Services Crisis**: 
   - securityManager.ts: 1611 lines (needs 4 separate services)
   - supabase.ts: 1583 lines (needs 4 separate services)
   - enhancedSupabasePool.ts: 1405 lines (needs 3 separate services)

2. **Type Safety Degradation**:
   - 905 instances of `any` type usage across codebase
   - 200+ ESLint warnings affecting maintainability
   - Target: Reduce to <450 `any` instances within 30 days

3. **Configuration Rigidity**:
   - Hardcoded WebSocket URLs (Binance, Twelve Data)
   - Hardcoded timeouts and market data prices
   - Missing environment variables for deployment flexibility

#### Immediate Action Plan
- **Week 1**: Break down securityManager.ts, start `any` type reduction
- **Month 1**: Complete service decomposition, implement interfaces
- **Quarter 1**: Achieve >80% test coverage, standardize patterns

#### Breaking Points & Risks
- Connection pool failures cascade through 15+ services
- Cache invalidation failures block database operations
- Security validation failures prevent all data operations
- Performance monitoring overhead affects application performance
