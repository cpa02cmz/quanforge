
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

## 6. Codebase Analysis Results (December 2025)

### Current Architecture Assessment
**Overall Score: 4.3/5.0 (86/100)**

| Category | Score | Status |
|----------|-------|--------|
| Stability | 92/100 | ✅ Excellent |
| Performance | 78/100 | ✅ Good |
| Security | 95/100 | ✅ Excellent |
| Scalability | 75/100 | ✅ Good |
| Modularity | 68/100 | ⚠️ Fair |
| Flexibility | 90/100 | ✅ Excellent |
| Consistency | 82/100 | ✅ Good |

### Critical Findings
#### 🔴 **Critical Issues**
- **Service Over-engineering**: 86 service files for single-page application (excessive)
- **Bundle Size**: 247MB total project size indicates dependency bloat
- **Architecture Complexity**: Over-abstraction impacts maintainability

#### 🟢 **Exceptional Strengths**
- **Enterprise Security**: WAF implementation with 9+ attack type detection
- **Production-Ready Error Handling**: Circuit breakers, retry logic, graceful degradation
- **Advanced Performance**: Multi-layered caching across all service layers
- **Flexible Architecture**: Multi-provider AI support, dual database modes

### Service Architecture Health
```
Services: 83 files (Target: <30) ✅ Progress: 3 files removed
├── Cache Management: 9 files (⚠️ Consolidate to 3-4) ✅ Phase 1 Complete
├── Performance: 18 files (⚠️ Merge redundant optimizations)
├── Security: 8 files (✅ Well-structured)
├── Database: 15 files (⚠️ Over-abstracted)
├── AI Services: 12 files (✅ Appropriate separation)
└── Edge/CDN: 21 files (⚠️ Excessive granularity)
```

### Immediate Action Items
1. **Service Consolidation** (Week 1-2) ✅ Phase 1 Complete
   - ✅ **Completed**: Removed `advancedAPICache`, `edgeCacheStrategy`, `optimizedSupabasePool` (3 files, 1,035 lines)
   - 🔄 **Next**: Merge cache implementations: `smartCache` + `optimizedCache` → enhance `unifiedCacheManager`
   - 🔄 **Next**: Combine performance services: `performanceOptimizer`, `frontendOptimizer`, `edgeOptimizer`
   - Target: Reduce from 83 to <30 core services

2. **Bundle Optimization** (Week 2-3)
   - Implement aggressive tree-shaking for unused dependencies
   - Split into separate deployment packages (AI, Database, Core)
   - Target: Reduce total size by 40%

3. **Documentation Enhancement** (Week 3-4)
   - Add comprehensive service interaction documentation
   - Create architecture decision records (ADRs)
   - Document complex caching and performance patterns

## 7. Deployment Considerations

### Build Compatibility
- **Cross-Platform Environment**: All code must work in browser, Node.js, and edge environments
- **Module Restrictions**: Avoid Node.js-specific modules (`crypto`, `fs`, `path`) in frontend code
- **Schema Compliance**: Platform configuration files must follow current schema requirements

### Known Issues & Solutions
- **Browser Crypto**: Replace Node.js `crypto` with browser-compatible alternatives
- **Vercel Schema**: Use minimal, schema-compliant `vercel.json` configuration
- **Build Validation**: Always run build and typecheck before deployment
- **Service Bloat**: Implement regular service audits to prevent re-accumulation
