
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

### Performance Optimization Status (2025-12-21 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs

### Code Quality Standards
- **Type Safety**: Minimize `any` usage, implement strict TypeScript
- **Modularity**: Service files should be <500 lines, well-decoupled
- **Consistency**: Unified error handling, naming conventions, patterns
- **Testing**: >80% test coverage for critical paths

### Comprehensive Codebase Analysis Results (2025-12-22)
#### Quality Assessment Scores
| Category | Score (0-100) | Status |
|----------|---------------|--------|
| Stability | 85 | Excellent |
| Performance | 90 | Outstanding |
| Security | 88 | Excellent |
| Scalability | 82 | Good |
| Modularity | 65 | Needs Improvement |
| Flexibility | 70 | Fair |
| Consistency | 72 | Fair |

#### Critical Findings & Actions Required

**Strengths:**
- **Performance Engineering**: Sophisticated Vite config (320 lines) with edge optimization and 12+ chunk categories
- **Security Infrastructure**: Enterprise-grade security manager (1,612 lines) with comprehensive threat protection
- **Reliability**: Robust error boundaries (120 lines) with circuit breaker patterns and monitoring systems
- **Architecture**: Edge-ready design with multi-layer caching and graceful degradation
- **Configuration Management**: Centralized configuration system with environment variable support (COMPLETED 2025-12-22)

**Critical Technical Debt:**
- **Monolithic Services**: `services/` dir has 86 files with 41,125+ lines; `supabase.ts` is 1,584 lines (violates SRP)
- **Type Safety Degradation**: 825+ `any` type usages reducing compile-time safety and increasing runtime errors
- **✅ Hardcoded Configuration**: RESOLVED - Centralized configuration system implemented with 25+ environment variables
- **Pattern Inconsistency**: Multiple caching implementations, variable error handling, mixed naming conventions

#### Immediate Action Plan (Next 30 Days)
1. **Service Decomposition**: Break monolithic services >500 lines into focused modules
2. **Type Safety**: Reduce `any` usage from 825 to <400 instances through proper interfaces
3. **✅ Configuration Management**: COMPLETED - Centralized system with environment variables implemented
4. **Pattern Standardization**: Choose single approaches for error handling, caching, validation

#### Evidence-Based Insights
- `vite.config.ts`: Advanced chunking strategy shows performance engineering maturity
- `services/securityManager.ts`: 1,612 lines demonstrates security-first approach
- `services/supabase.ts`: 1,584 lines illustrates maintenance burden of monolithic design
- `utils/errorHandler.ts`: 452 lines shows robust error management philosophy
- Component structure: Well-organized 16 React components provide modularity template

#### Architectural Decision Records
- **Edge Computing Commitment**: Comprehensive Vercel Edge optimization is core strength
- **Security-First Development**: Advanced threat detection and validation systems in place
- **Performance Budgeting**: Memory monitoring and token budget management implemented
- **Technical Debt Acknowledgment**: Service refactoring and type safety prioritized for maintainability
