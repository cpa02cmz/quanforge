
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
*   **Enhanced Security**: Advanced API key encryption with additional obfuscation layers
*   **XSS Protection**: Comprehensive input sanitization across all user inputs
*   **API Key Leak Detection**: Proactive monitoring and alerting for potential API key exposure
*   **Performance Monitoring**: Built-in metrics collection for API and database operations
