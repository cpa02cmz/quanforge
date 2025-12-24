
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

### Critical Technical Debt Resolution (2025-12-24 COMPLETED)
- **Build System**: ✅ Fixed TypeScript compilation and restored functionality  
- **Type Safety**: Major progress on `any` type reduction through interface improvements
- **Maintainability**: ✅ Monolithic services decomposed into 12 focused modules
- **Code Quality**: ✅ Advanced optimizations implemented, build system restored
- **Performance**: ✅ Bundle optimization with 25+ granular chunk categories
- **Configuration**: ✅ 32+ hardcoded values centralized in config system
- **Flow Optimization**: ✅ Nested await patterns resolved, console statements removed
- **Service Architecture**: ✅ 3 major monolithic services (2,376 lines) decomposed into modular components

### Comprehensive Codebase Quality Analysis (2025-12-23)
- **Overall Score**: 81/100 - Good architecture with strong technical foundation
- **Strengths**: Performance (90/100), Security (88/100), Stability (85/100)
- **Key Architectural Wins**:
  - Advanced multi-layer edge caching with regional replication
  - Comprehensive security framework with WAF and CSP monitoring
  - Sophisticated build optimization with 25+ chunk categories
  - Circuit breaker patterns and resilient error handling
- **Areas for Improvement**:
  - Service decomposition (some files >1000 lines)
  - Type safety enhancement (reduce `any` type usage)
  - Configuration externalization for better flexibility

### Performance Optimization Status (2025-12-22 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular component, service, and route-based optimization  
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Compression**: Triple-pass terser optimization
- **Schema Compliance**: Clean, deployment-ready configuration files
- **PR Management**: Systematic resolution of deployment issues across multiple PRs
- **Database Optimization**: PR #132 ready with comprehensive indexing and query optimization
- **Deployment Reliability**: Optimized vercel.json pattern for consistent platform deployments

### Code Quality Standards
- **Type Safety**: Minimize `any` usage (Current: 4,172 instances, Target: <450), implement strict TypeScript
- **Modularity**: Service files should be <500 lines, well-decoupled (Current issues: backendOptimizationManager.ts 918 lines)
- **Consistency**: Unified error handling, naming conventions, patterns
- **Testing**: >80% test coverage for critical paths

### Latest Codebase Analysis Results (2025-12-24)
- **Overall Score**: 79/100 - Good architecture with some technical debt
- **Stability**: 82/100 - Strong error handling but type safety issues
- **Performance**: 85/100 - Advanced optimization but large vendor chunks
- **Security**: 88/100 - Comprehensive protection with good practices
- **Scalability**: 78/100 - Good caching but some scaling limitations
- **Modularity**: 65/100 - Clear structure but monolithic services
- **Flexibility**: 92/100 - Excellent configurability and feature flags
- **Consistency**: 70/100 - Generally good but patterns vary

### Critical Issues Identified
- **Type Safety Crisis**: 4,172 `any` type usages requiring systematic reduction
- **Monolithic Services**: Several files >500 lines need decomposition
- **Bundle Optimization**: Large vendor chunks (356KB charts, 224KB React) need splitting
