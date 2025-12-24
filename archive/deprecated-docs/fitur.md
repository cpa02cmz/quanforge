
# QuantForge AI - Feature List

## 1. Core Generation Engine
*   **Natural Language to Code**: Converts English descriptions into MQL5 (MetaTrader 5) code.
*   **Multi-Provider Support**:
    *   **Google Gemini**: Native support for `gemini-3-pro-preview` and `gemini-2.5-flash`.
    *   **OpenAI Compatible**: Support for Groq, OpenRouter, DeepSeek, and Local LLMs (Ollama) via `baseUrl` configuration.
*   **Key Rotation**: Supports multiple API keys for load balancing/rate limit avoidance.
*   **Stop Generation**: Ability to cancel long-running AI requests immediately.
*   **Code Explanation**: "Explain Code" feature analyzes generated logic in plain English for better understanding.
*   **Smart Context Management**: Token budgeting system prevents context overflow on long conversations.

## 2. Editor & IDE
*   **Syntax Highlighting**: PrismJS integration for C++/MQL5 highlighting.
*   **Line Numbers**: IDE-like experience with synchronized gutter.
*   **Manual Editing**: Toggle between "View" and "Edit" modes to manually tweak generated code.
*   **Download**: Export generated logic as `.mq5` files.

## 3. Strategy Configuration (No-Code)
*   **Visual Form**: Configure Timeframe, Symbol, Risk %, and Magic Number without coding.
*   **Pips-based Inputs**: Enter Stop Loss and Take Profit in Pips; the system automatically generates the Point conversion logic.
*   **Dynamic Custom Inputs**: Add unlimited custom variables (bool, int, double, string) that appear in the MT5 inputs window.
*   **Real-Time Market Data**: 
    *   **Live WebSockets**: Connects to Binance for Crypto and Twelve Data for Forex/Gold.
    *   **Status Indicators**: Visual feedback for connection health (Live/Disconnected).

## 4. Analysis & Simulation
*   **AI Analysis**:
    *   **Risk Score**: 1-10 rating of strategy safety.
    *   **Profitability Score**: 1-10 potential rating.
    *   **Summary**: Textual explanation of logic strengths/weaknesses.
*   **Monte Carlo Simulation**:
    *   Project equity curves based on AI Risk/Profit scores.
    *   Adjust Deposit, Leverage, and Duration.
    *   **Export to CSV**: Download simulation data for Excel analysis.

## 5. Data Management
*   **Dashboard**: Grid view of all created robots.
*   **CRUD Operations**: Create, Read, Update, Delete, and Duplicate robots.
*   **Persistence**:
    *   **Mock DB**: Robust LocalStorage implementation with **Quota Protection** (Handles 5MB browser limits gracefully).
    *   **Supabase**: Optional integration for cloud sync.
    *   **UUID Standardization**: Uses crypto-secure UUIDs for all records.
*   **Data Migration**: One-click migration tool to move LocalStorage (Mock) robots to Supabase Cloud (Batch processed for stability).
*   **Import/Export DB**: 
    *   Backup your entire database to JSON and restore it.
    *   **Schema Validation**: Automatically sanitizes imported data and checks file sizes.
*   **Chat History**: Conversation history is saved per robot.

## 6. UX & Accessibility
*   **Responsive Design**: Fully functional on Mobile with Drawer Navigation and Tabbed Interfaces.
*   **Toast Notifications**: Global feedback for actions (Save, Error, Info).
*   **Import/Export Config**: Copy strategy settings as JSON or import from clipboard (with manual fallback).
*   **Quick Start**: Pre-defined strategy prompts to jumpstart generation.
*   **Audit Trail**: Logs AI refinements in the chat history for transparency.
*   **High Performance**: Memoized chat rendering for lag-free typing even with long histories.
*   **Multi-Language**: Full i18n support for English and Indonesian.
