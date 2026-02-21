# QuantForge AI - User Guide

Welcome to QuantForge AI, your advanced platform for creating MQL5 trading robots using artificial intelligence. This comprehensive guide covers everything you need to know about using the platform effectively.

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [Core Features](#core-features)
3. [Creating Your First Robot](#creating-your-first-robot)
4. [Strategy Configuration](#strategy-configuration)
5. [Code Management](#code-management)
6. [Analysis & Simulation](#analysis--simulation)
7. [Data Management](#data-management)
8. [Advanced Settings](#advanced-settings)
9. [Repository Overview](#repository-overview)

---

## Getting Started

### Quick Start Process
1. **Create Account**: Sign up or use the platform without registration (mock mode available)
2. **Create First Robot**: Navigate to Dashboard → "Create New Robot"
3. **Describe Strategy**: Write your trading strategy in natural language
4. **Generate Code**: AI converts your description to MQL5 code automatically
5. **Configure Parameters**: Set risk management, timeframes, and custom inputs
6. **Test & Deploy**: Analyze performance and export to MetaTrader 5

---

## Core Features

### 🚀 AI-Powered Generation Engine
- **Natural Language to Code**: Convert English descriptions to MQL5 (MetaTrader 5) code
- **Multiple AI Providers**: 
  - **Google Gemini**: Native support for `gemini-3-pro-preview` and `gemini-2.5-flash`
  - **OpenAI Compatible**: Support for Groq, OpenRouter, DeepSeek, Local LLMs (Ollama) via `baseUrl`
- **Smart Key Rotation**: Multiple API keys for load balancing and rate limit avoidance
- **Stop Generation**: Cancel long-running AI requests immediately
- **Code Explanation**: "Explain Code" feature analyzes generated logic in plain English
- **Smart Context Management**: Token budgeting prevents context overflow in long conversations

### 📝 Advanced Editor & IDE
- **Syntax Highlighting**: PrismJS integration for professional C++/MQL5 highlighting
- **Line Numbers**: IDE-like experience with synchronized gutter
- **Manual Editing**: Toggle between "View" and "Edit" modes for manual code tweaks
- **Export Capabilities**: Download generated code as `.mq5` files for MetaTrader 5

### ⚙️ No-Code Strategy Configuration
- **Visual Form Interface**: Configure Timeframe, Symbol, Risk %, Magic Number without coding
- **Pips-based Inputs**: Enter Stop Loss and Take Profit in Pips; automatic Point conversion in code
- **Dynamic Custom Inputs**: Add unlimited custom variables (bool, int, double, string) for MT5 inputs
- **Real-Time Market Data Integration**:
  - **Live WebSockets**: Connect to Binance (Crypto) and Twelve Data (Forex/Gold)
  - **Status Indicators**: Visual feedback for connection health (Live/Disconnected)

### 📊 Analysis & Simulation Tools
- **AI-Powered Strategy Analysis**:
  - **Risk Score**: 1-10 rating of strategy safety
  - **Profitability Score**: 1-10 potential rating  
  - **Comprehensive Summary**: Textual explanation of strengths and weaknesses
- **Monte Carlo Simulation**:
  - Project equity curves based on AI Risk/Profit scores
  - Adjust Deposit, Leverage, and Duration parameters
  - **Export to CSV**: Download simulation data for Excel analysis

### 💾 Advanced Data Management
- **Dashboard**: Grid view with search and filter capabilities
- **CRUD Operations**: Full Create, Read, Update, Delete, and Duplicate functionality
- **Dual Persistence Options**:
  - **Mock Database**: Robust LocalStorage implementation with Quota Protection (handles 5MB browser limits)
  - **Supabase Cloud**: Optional cloud sync for multi-device access
- **Data Migration**: One-click migration from LocalStorage to Supabase (batch processed for stability)
- **Import/Export Capabilities**:
  - Backup entire database to JSON and restore
  - Schema validation and automatic sanitization
  - Chat history preservation per robot

### 🎨 User Experience & Accessibility
- **Responsive Design**: Fully functional on Mobile with Drawer Navigation and Tabbed Interfaces
- **Toast Notifications**: Global feedback system for Save, Error, Info actions
- **Configuration Sharing**: Copy strategy settings as JSON or import from clipboard
- **Quick Start Templates**: Pre-defined strategy prompts to jumpstart generation
- **Audit Trail**: Complete log of AI refinements for transparency
- **High Performance**: Memoized chat rendering for lag-free typing with long histories
- **Multi-Language Support**: Full i18n for English and Indonesian

---

## Creating Your First Robot

### Step-by-Step Process

#### 1. Navigate to Generator
1. Go to the **Dashboard** and click **"Create New Robot"**
2. You'll be taken to the **Generator** workspace
3. The workspace has two main panels: AI Chat (left) and Code Editor (right)

#### 2. Describe Your Strategy
In the **AI Chat** panel, type a detailed description of your trading strategy:

**Example Prompts:**
- *"Create a strategy that buys when the 14-period RSI crosses above 30 and sells when it crosses below 70."*
- *"Generate a scalping bot that uses Bollinger Bands and MACD for EURUSD on M5 timeframe."*
- *"Build a trend-following strategy using moving average crossovers with 2% risk per trade."*

#### 3. Generate Initial Code
- Press **Enter** or click the send button
- The AI will process your request and generate MQL5 code in the **Code Editor**
- Review the generated code and explanations

#### 4. Refine and Iterate
- Ask for modifications: *"Add a stop loss of 50 pips"* or *"Include trailing stop functionality"*
- The AI will refine the code based on your feedback
- Continue until you're satisfied with the strategy logic

---

## Strategy Configuration

### Accessing Configuration
1. Click the **Settings** tab in the left sidebar
2. Configure basic and advanced parameters
3. Click **"Apply Changes & Update Code"** to incorporate settings

### Basic Parameters

#### Timeframe & Symbol
- **Timeframe**: Select from M1, M5, M15, M30, H1, H4, D1, etc.
- **Symbol**: Choose from forex pairs, commodities, indices, or cryptocurrencies

#### Risk Management
- **Risk Percent**: Set percentage of account to risk per trade (1-10% recommended)
- **Stop Loss**: Enter value in **Pips** (automatically converted to Points)
- **Take Profit**: Enter value in **Pips** (automatic conversion applied)

#### Magic Number
- **Magic Number**: Unique identifier for trades (auto-generated or custom)

### Advanced Custom Inputs

#### Adding Custom Variables
1. Click **"Add Input"** in the Settings panel
2. Configure the input:
   - **Name**: Variable name (e.g., `RSI_Period`, `Moving_Fast`)
   - **Type**: bool, int, double, or string
   - **Default Value**: Initial setting
   - **Description**: Brief explanation for MT5 input window

#### Common Custom Input Examples
```typescript
// Technical Indicators
RSI_Period: int = 14          // RSI calculation period
MACD_Fast: int = 12           // MACD fast EMA period  
MACD_Slow: int = 26           // MACD slow EMA period
BB_Period: int = 20           // Bollinger Bands period
BB_Deviation: double = 2.0    // Bollinger Bands deviation

// Strategy Parameters
Max_Trades: int = 1           // Maximum concurrent trades
Use_Trailing: bool = true     // Enable trailing stop
Trail_Distance: int = 20      // Trailing stop distance in pips
Profit_Target: int = 50       // Take profit target in pips
```

---

## Code Management

### Viewing Generated Code
- **Syntax Highlighting**: Professional code display with MQL5/C++ highlighting
- **Line Numbers**: IDE-like numbering for easy reference
- **Code Structure**: Organized with standard MQL5 structure (OnInit, OnTick, OnDeinit)

### Manual Editing Mode
1. In the **Code Editor**, click the **"Edit Code"** button
2. Make your desired changes directly
3. Click **"Done Editing"** to return to view mode
4. **Important**: Click **Save** in the header to persist manual changes

### Code Export Options
- **Download .mq5**: Export the complete MQL5 file for MetaTrader 5
- **Copy to Clipboard**: Copy code for easy pasting into MT5 MetaEditor

### Code Analysis Features
- **Explain Code**: AI explains complex logic in plain English
- **Error Detection**: Automatic detection of common MQL5 syntax issues
- **Optimization Suggestions**: Recommendations for code improvement

---

## Analysis & Simulation

### Strategy Analysis Tab
Switch to the **Strategy Analysis** tab on the right side to access:

#### Risk Assessment
- **Risk Score (1-10)**: Visual gauge showing strategy risk level
  - **Green (1-3)**: Low risk, conservative approach
  - **Yellow (4-6)**: Moderate risk, balanced strategy
  - **Red (7-10)**: High risk, aggressive approach

#### Profitability Analysis  
- **Profitability Score (1-10)**: Potential rating based on strategy logic
- **AI Summary**: Detailed explanation of strengths and weaknesses
- **Market Condition Analysis**: Performance expectations across different market types

### Monte Carlo Simulation

#### Running Simulations
1. Go to the **Simulation** tab
2. Configure parameters:
   - **Initial Deposit**: Starting account balance
   - **Leverage**: Account leverage (1:100, 1:500, etc.)
   - **Simulation Period**: Duration in months/years
3. Click **"Run Simulation"**

#### Understanding Results
- **Equity Curve**: Projected account balance over time
- **Drawdown Analysis**: Maximum potential losses
- **Win Rate**: Expected percentage of profitable trades
- **Profit Factor**: Ratio of total profits to total losses

#### Export Capabilities
- **CSV Export**: Download complete simulation data for Excel analysis
- **Chart Export**: Save equity curve as image

---

## Data Management

### Dashboard Overview

#### Robot Grid View
- **Visual Grid**: All created robots displayed in an organized grid
- **Status Indicators**: Visual cues for robot health and activity
- **Quick Actions**: Edit, duplicate, delete directly from grid

#### Search and Filter
- **Search Bar**: Find robots by name or description
- **Filter Dropdown**: Filter by strategy type:
  - Scalping
  - Swing Trading  
  - Trend Following
  - Range Trading
  - Custom

### Robot Management

#### Operations
- **Create**: Click "Create New Robot" to start a new strategy
- **Read**: Click any robot to view and edit
- **Update**: Modify parameters, regenerate code, update settings
- **Delete**: Remove robots (with confirmation)
- **Duplicate**: Create copies for testing variations

#### Organization Features
- **Rename**: Give robots descriptive names
- **Tags**: Categorize robots for better organization
- **Favorites**: Mark frequently used robots

### Persistence Options

#### Local Storage (Mock Mode)
- **Automatic Saving**: All changes saved locally
- **Quota Management**: Handles browser 5MB limitation gracefully
- **Offline Access**: Available without internet connection
- **Privacy**: Data stays on your device

#### Supabase Cloud Sync
- **Multi-Device Access**: Sync across multiple devices
- **Automatic Backup**: Professional-grade data protection
- **Collaboration**: Share robots with team members
- **Version History**: Track changes over time

### Data Migration

#### Local to Cloud Migration
1. Go to **Settings** → **Data Migration**
2. Click **"Migrate to Cloud"**
3. Select robots to migrate
4. **Batch Processing**: Automatic migration for stability
5. **Verification**: Confirm successful transfer

#### Cloud to Local Backup
1. **Export Database**: Download complete JSON backup
2. **Import Database**: Restore from backup file
3. **Validation**: Automatic data integrity checks
4. **Conflict Resolution**: Handle duplicate entries

### Configuration Management

#### Export Strategy Settings
1. Go to **Settings** tab
2. Click **"Copy JSON"**
3. Configuration copied to clipboard

#### Import Strategy Settings  
1. Click **"Import JSON"** in Settings
2. **Automatic Clipboard**: Attempts to read from clipboard
3. **Manual Fallback**: Text box appears if clipboard access blocked
4. **Validation**: Automatic schema verification

---

## Advanced Settings

### AI Configuration

#### Provider Settings
1. Click **"AI Settings"** button (bottom left sidebar)
2. **Provider Selection**:
   - **Google Gemini** (Default): Native integration
   - **OpenAI Compatible**: Custom providers (Groq, OpenRouter, DeepSeek, Local LLMs)
3. **API Key Management**:
   - Add multiple keys for load balancing
   - Automatic key rotation for rate limits
   - Secure key storage

#### Custom System Instructions
1. In **AI Settings**, locate **System Instructions** text area
2. Add global rules for code generation:

**Examples:**
```
Always add detailed comments explaining each code block
Use Hungarian notation for variables (s_ for string, n_ for number)
Include comprehensive error handling
Generate code optimized for H1 timeframe
```

3. Click **Save Settings** to apply to all future generations

### Connection Management

#### Market Data Connections
1. **WebSocket Status**: Monitor connection health
2. **Provider Configuration**:
   - **Binance**: Cryptocurrency data
   - **Twelve Data**: Forex, stocks, commodities
3. **Reconnection Logic**: Automatic recovery from disconnections
4. **Data Validation**: Ensure real-time accuracy

### Performance Settings

#### Optimization Options
- **Caching**: Enable/disable strategy result caching
- **Memory Management**: Configure chat history limits
- **Performance Mode**: Optimize for speed vs. memory usage

#### Development Mode
- **Debug Mode**: Additional logging and diagnostics
- **Test Mode**: Safe environment for strategy testing
- **Production Mode**: Optimized for live usage

---

## Repository Overview

### Technical Architecture

#### Platform Efficiency (Latest Improvements)
The repository has undergone comprehensive consolidation for optimal performance:

##### 🚀 Code Consolidation Achievements
- **SEO System**: 7 duplicate files → 1 unified `seoUnified.tsx`
- **Performance System**: 4 modules → 1 unified `performanceConsolidated.ts`  
- **Validation System**: 6 overlapping modules → focused `validationCore.ts` + wrappers
- **Documentation**: 80+ redundant files → 8 core files + archived repository

##### 📊 Efficiency Metrics
- **Bundle Size**: 15-20% reduction through code consolidation
- **Build Performance**: 25-30% faster builds with fewer files
- **Code Duplication**: 80% reduction across major utilities
- **File Count**: 35% fewer files to maintain
- **AI Context**: 90% reduction in documentation noise for better agent performance

##### 🔧 API Architecture
- **Route Consolidation**: API routes reduced by 78% (2,162 → 470 lines)
- **Shared Utilities**: Common patterns consolidated in `utils/apiShared.ts`
- **Error Handling**: Unified error responses with proper HTTP status codes
- **Performance Monitoring**: Automatic metrics collection for all endpoints

### For Developers
- **Documentation**: Check `AGENTS.md` for development guidelines
- **Code Standards**: See `coding_standard.md` for conventions
- **Architecture**: Review `blueprint.md` for system design
- **Service Architecture**: Complete reference in `docs/SERVICE_ARCHITECTURE.md`

---

## Troubleshooting & Support

### Common Issues

#### Code Generation Problems
- **AI Timeouts**: Try shorter, more specific strategy descriptions
- **Invalid Code**: Use "Explain Code" feature to identify issues
- **Compilation Errors**: Check MQL5 syntax requirements

#### Data Persistence Issues  
- **Storage Full**: Archive old robots or migrate to cloud
- **Sync Problems**: Check network connection for Supabase sync
- **Import Failures**: Verify JSON format and file size limits

#### Performance Issues
- **Slow Generation**: Check internet speed and AI provider status
- **Memory Issues**: Clear chat history or optimize memory settings
- **Display Problems**: Refresh page and check browser compatibility

### Getting Help
- **Documentation**: Check this guide and referenced documents
- **Bug Reports**: Review `bug.md` for known issues and fixes
- **Community**: Check platform announcements and updates
- **Support**: Use the platform feedback system for issues

---

## Best Practices

### Strategy Development
1. **Start Simple**: Begin with basic logic, then add complexity
2. **Test Thoroughly**: Use simulation before live deployment
3. **Risk Management**: Always maintain proper stop losses
4. **Documentation**: Document strategy logic for future reference
5. **Version Control**: Duplicate robots before major changes

### Code Management
1. **Regular Saves**: Save frequently to prevent data loss
2. **Backups**: Export important strategies regularly
3. **Clean Organization**: Use descriptive naming and tags
4. **Review Changes**: Verify AI modifications before accepting

### Platform Usage
1. **Browser Choice**: Use modern browsers for best performance
2. **Internet Connection**: Stable connection required for AI features
3. **Security**: Keep API keys secure and rotate regularly
4. **Updates**: Check for new features and improvements

---

### 🎉 You're Ready!

With this comprehensive guide, you have everything needed to create sophisticated trading robots using QuantForge AI. Start with simple strategies, explore the advanced features, and leverage the powerful AI capabilities to automate your trading ideas.

**Key Success Factors:**
- Clear, specific strategy descriptions
- Proper risk management configuration  
- Thorough testing before deployment
- Continuous learning and iteration

Happy trading with QuantForge AI!

---

**Last Updated**: February 21, 2026  
**Platform Version**: v1.9.0
**Documentation Version**: Consolidated User Guide v2.2