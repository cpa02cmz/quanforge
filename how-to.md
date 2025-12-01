
# How-To Guide: QuantForge AI

Welcome to QuantForge AI. This guide will help you navigate the platform and create your first trading robot.

## 1. Creating Your First Robot

1.  Navigate to the **Dashboard** and click **"Create New Robot"**.
2.  You will be taken to the **Generator** workspace.
3.  In the **AI Chat** panel (left side), type a description of your strategy.
    *   *Example: "Create a strategy that buys when the 14-period RSI crosses above 30 and sells when it crosses below 70."*
4.  Press **Enter** or click the send button.
5.  The AI will process your request and generate MQL5 code in the **Code Editor** (right side).

## 2. Configuring Strategy Parameters

Sometimes you want to change settings (like Risk or Timeframe) without asking the AI to rewrite the whole code.

1.  Click the **Settings** tab in the left sidebar.
2.  Adjust **Timeframe** (e.g., H1), **Symbol**, or **Risk Percent**.
3.  **Stop Loss / Take Profit**: Enter values in **Pips**.
    *   *Note: The system automatically converts Pips to Points in the generated code.*
4.  **Custom Inputs**: Click "Add Input" to define new variables (e.g., `RSI_Period`).
5.  Click **"Apply Changes & Update Code"** at the bottom. The AI will regenerate the code to respect these new settings strictly.

## 3. Manual Editing

If you are a developer or want to make a quick fix:

1.  In the **Code Editor** (right side), click the **"Edit Code"** button in the top toolbar.
2.  The view changes to an interactive editor.
3.  Type your changes.
4.  Click **"Done Editing"** to switch back to the syntax-highlighted view.
5.  **Important**: Don't forget to click **Save** in the top left header to persist your manual changes.

## 4. Analyzing Your Strategy

1.  Switch to the **Strategy Analysis** tab on the right side.
2.  View the **Risk Score** (Red/Green chart) and the **Profitability Potential**.
3.  Read the AI-generated summary to understand the strengths and weaknesses of your logic.

## 5. Advanced AI Settings & Custom Instructions

You can customize how the AI behaves:

1.  Click the **"AI Settings"** button in the sidebar (bottom left).
2.  **Provider**: Switch between Google Gemini (Default) or an OpenAI-compatible provider (e.g., Local LLM).
3.  **Custom System Instructions**: In the textarea provided, you add global rules.
    *   *Example: "Always add comments in German."*
    *   *Example: "Use 'm_' prefix for member variables."*
4.  **Enhanced API Reliability**: The system now includes improved retry logic with network error handling for better API connections.
5.  Click **Save Settings**. These rules will apply to all future code generations.

## 6. Managing Your Robots

1.  Go back to the **Dashboard**.
2.  Use the **Search Bar** to find robots by name.
3.  Use the **Filter Dropdown** to see specific strategy types (e.g., Scalping).
4.  **Duplicate**: Click the copy icon to clone a robot (useful for testing variations).
5.  **Delete**: Click the trash icon to remove a robot.

## 7. Exporting & Importing

*   **Code**: Click **"Download .mq5"** in the Code Editor toolbar to get the file for MetaTrader 5.
*   **Config Export**: Click **"Copy JSON"** in the Settings tab to copy your configuration to the clipboard.
*   **Config Import**: Click **"Import JSON"** in the Settings tab.
    *   The app attempts to read from your clipboard automatically.
    *   **Troubleshooting**: If your browser blocks clipboard access (common on non-HTTPS sites), a text box will appear. Paste your JSON configuration manually into this box and click "Import".
