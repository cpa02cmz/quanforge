
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

### Comprehensive Codebase Analysis (2025-12-22)

**Overall Assessment: 76/100 - Strong Architecture with Manageable Technical Debt**

| Category | Score | Status | Key Findings |
|----------|-------|--------|--------------|
| **Security** | 88/100 | 🟢 Excellent | Enterprise-grade threat protection, comprehensive validation |
| **Performance** | 85/100 | 🟢 Excellent | Sophisticated optimization, 12.78s build time |
| **Scalability** | 82/100 | 🟢 Good | Advanced connection pooling, edge-ready architecture |
| **Stability** | 78/100 | 🟢 Good | Comprehensive error handling, circuit breakers |
| **Flexibility** | 81/100 | 🟢 Good | 42+ environment variables, feature flags |
| **Consistency** | 76/100 | 🟢 Good | Unified patterns, TypeScript strict mode |
| **Modularity** | 73/100 | 🟡 Needs Improvement | Some monolithic services (>500 lines) |

### Critical Technical Debt (2025-12-22 Analysis)
- **Build System**: ✅ RESOLVED - Functional (12.78s build, 0 type errors)
- **Type Safety**: 905 `any` type usages requiring systematic reduction
- **Maintainability**: Monolithic services (securityManager.ts 1600+ lines) need decomposition
- **Code Quality**: Enterprise-level architecture with manageable debt items

### Performance Optimization Status (2025-12-22 Update)
- **Vite Configuration**: Advanced 320-line config with 25+ chunk categories
- **Bundle Splitting**: Granular optimization, largest chunk 356.36kB (chart-vendor)
- **Edge Performance**: Full Vercel Edge runtime optimization
- **Build Metrics**: 12.78s build time, 1.3MB total bundle (320kB gzipped)
- **Schema Compliance**: Clean, deployment-ready configuration files
- **Performance Monitoring**: Comprehensive metrics and alerting system

### Code Quality Standards & Targets
- **Type Safety**: Reduce `any` from 905 to <450 instances (30-day target)
- **Modularity**: Decompose services >300 lines, implement dependency injection
- **Consistency**: Unified error handling, naming conventions, architectural patterns
- **Testing**: Implement >80% test coverage for critical paths
- **Documentation**: Comprehensive API docs and component documentation
