# Quick Start Guide - Create Your First Trading Strategy

This guide will walk you through creating your first MQL5 trading strategy with QuantForge AI in under 10 minutes.

## Prerequisites

- [x] Google Gemini API key ([Get one here](https://aistudio.google.com))
- [x] Node.js 18+ installed
- [x] Basic understanding of trading concepts (optional)

## Step 1: Install and Run

1. **Clone the repository**:
    ```bash
    git clone https://github.com/cpa02cmz/quanforge.git
    cd quanforge
    ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your Gemini API key:
   VITE_API_KEY=your_google_gemini_api_key_here
   ```

4. **Start the application**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   ```
   http://localhost:5173
   ```

---

## Step 2: Create Your First Strategy

### 2.1 Sign In or Start in Mock Mode

**Option A: Sign In (Recommended for saving work)**
1. Click "Sign In" button
2. Enter your email and create a password
3. You'll be logged in automatically (demo mode)

**Option B: Mock Mode (Quick start, data not saved)**
- Skip sign in
- All features work but data is lost on page refresh

### 2.2 Navigate to Generator

1. Click **"Generator"** in the sidebar
2. You'll see the strategy creation interface with tabs:
   - **Chat**: AI conversation for describing strategies
   - **Settings**: Configure strategy parameters
   - **Code**: View/edit generated MQL5 code
   - **Analysis**: Strategy risk and profitability assessment
   - **Simulation**: Monte Carlo backtesting

### 2.3 Describe Your Strategy Using AI

In the **Chat** tab:

**Example 1: Simple Moving Average Crossover**
```
Create a moving average crossover strategy. Use a 20-period EMA and a 50-period EMA. 
Buy when the 20 EMA crosses above the 50 EMA. Sell when it crosses below.
```

**Example 2: RSI Reversal**
```
Create an RSI-based reversal strategy. Use a 14-period RSI.
Buy when RSI drops below 30 (oversold) and starts rising.
Sell when RSI goes above 70 (overbought) and starts falling.
```

**Example 3: Breakout Strategy**
```
Create a breakout strategy based on Bollinger Bands.
Buy when price breaks above the upper band.
Sell when price breaks below the lower band.
Use a 20-period Bollinger Band with 2 standard deviations.
```

**Tips for Better Prompts**:
- Be specific about indicators and parameters
- Define entry and exit conditions clearly
- Mention timeframes if important
- Specify risk management rules
- Start simple, then refine

### 2.4 Generate the Strategy

1. Click the **Send** button (or press Enter)
2. Wait for AI to generate code (typically 3-10 seconds)
3. Review the generated strategy in the **Chat** tab
4. If not satisfied:
   - Ask for refinements: "Add a stop loss of 50 pips"
   - Request changes: "Use a trailing stop instead"
   - Start over: Click "Clear Chat" and try again

---

## Step 3: Configure Strategy Parameters

Switch to the **Settings** tab to customize your strategy:

### 3.1 Basic Settings

- **Symbol**: Currency pair (EURUSD, GBPUSD, etc.)
- **Timeframe**: Chart timeframe (M1, M5, M15, H1, H4, D1)
- **Lot Size**: Position size (0.01, 0.1, 1.0, etc.)

### 3.2 Risk Management

- **Stop Loss (Pips)**: Maximum acceptable loss per trade
  - Example: 50 pips = $50 loss on EURUSD for 1.0 lot
  - Conservative: 20-30 pips
  - Aggressive: 50-100 pips

- **Take Profit (Pips)**: Target profit per trade
  - Example: 100 pips = $100 profit on EURUSD for 1.0 lot
  - Risk/Reward Ratio: 1:2 is recommended (SL:TP = 50:100)

- **Risk Percent**: Percentage of account to risk per trade
  - Conservative: 1-2%
  - Moderate: 2-3%
  - Aggressive: 3-5%
  - **Never exceed 5% risk per trade**

### 3.3 Custom Inputs

Add custom parameters for your strategy:

**Example: EMA Crossover Strategy**
```
Name: Fast EMA Period
Type: Number
Value: 20

Name: Slow EMA Period
Type: Number
Value: 50

Name: EMA Cross Confirmation
Type: Boolean
Value: true
```

**Example: RSI Strategy**
```
Name: RSI Period
Type: Number
Value: 14

Name: Oversold Level
Type: Number
Value: 30

Name: Overbought Level
Type: Number
Value: 70
```

**Adding Custom Inputs**:
1. Click **"+ Add Input"** button
2. Enter parameter name
3. Select data type (Number, String, Boolean)
4. Set default value
5. Click **Save**

---

## Step 4: Review Generated Code

Switch to the **Code** tab:

### 4.1 Code Editor Features

- **Syntax Highlighting**: MQL5 code is color-coded for readability
- **Line Numbers**: Easy reference for code sections
- **Manual Editing**: You can edit the code directly if needed
- **Copy to Clipboard**: One-click copy of entire code
- **Download .mq5**: Download file for MetaTrader 5

### 4.2 Understanding the Generated Code

Typical MQL5 strategy structure:

```cpp
// Input parameters (from Settings tab)
input int FastEMA = 20;
input int SlowEMA = 50;
input double StopLoss = 50.0;
input double TakeProfit = 100.0;

// Global variables
int fastEMAHandle;
int slowEMAHandle;

// Initialize strategy
int OnInit() {
    // Create indicator handles
    fastEMAHandle = iMA(_Symbol, _Period, FastEMA, 0, MODE_EMA, PRICE_CLOSE);
    slowEMAHandle = iMA(_Symbol, _Period, SlowEMA, 0, MODE_EMA, PRICE_CLOSE);
    return(INIT_SUCCEEDED);
}

// Check for trading signals on each tick
void OnTick() {
    // Get indicator values
    double fastEMA = iMAGet(fastEMAHandle, 0);
    double slowEMA = iMAGet(slowEMAHandle, 0);

    // Check for crossover
    if (fastEMA > slowEMA && /* was below before */) {
        // Open buy order
    } else if (fastEMA < slowEMA && /* was above before */) {
        // Open sell order
    }
}
```

### 4.3 Manual Edits (Advanced)

If you know MQL5, you can manually edit the code:

**Common Edits**:
- Add additional indicators
- Implement custom risk management
- Add position sizing logic
- Implement trailing stops
- Add trade time filters

**Warning**: Manual edits are lost if you regenerate with AI. Save important changes separately.

---

## Step 5: Analyze Strategy Risk

Switch to the **Analysis** tab:

### 5.1 Risk Assessment

The AI provides an automated risk analysis:

**Risk Score (0-100)**:
- **0-25**: Low Risk - Conservative strategy
- **26-50**: Moderate Risk - Balanced approach
- **51-75**: High Risk - Aggressive strategy
- **76-100**: Very High Risk - Gambling territory

**Factors Considered**:
- Stop loss distance
- Risk per trade percentage
- Frequency of trades
- Indicator reliability
- Drawdown potential

### 5.2 Profitability Analysis

**Expected ROI**:
- Estimated return on investment
- Based on historical backtesting data
- **Warning**: Past performance doesn't guarantee future results

**Key Metrics**:
- Win Rate: Percentage of profitable trades
- Average Win/Loss Ratio
- Maximum Drawdown
- Sharpe Ratio (if available)

### 5.3 Risk Management Recommendations

Based on analysis, the AI suggests:
- Recommended lot size adjustments
- Stop loss modifications
- Risk percentage limits
- Market condition filters

---

## Step 6: Backtest Your Strategy

Switch to the **Simulation** tab:

### 6.1 Monte Carlo Simulation

Run probabilistic backtesting to assess strategy performance:

**Simulation Settings**:
- **Initial Deposit**: Starting account balance (e.g., $10,000)
- **Number of Trades**: Simulated trade count (100-10,000)
- **Iteration Count**: Number of simulation runs (100-1,000)
- **Confidence Interval**: 95% (standard)

### 6.2 Understanding Results

**Equity Curve**:
- Visual representation of account balance over time
- Green = Profitable
- Red = Drawdown
- Smooth curve = Stable strategy
- Volatile curve = Risky strategy

**Key Statistics**:
- **Average ROI**: Mean return across all simulations
- **Best Case**: Top 10% of outcomes
- **Worst Case**: Bottom 10% of outcomes
- **95% Confidence**: Range where 95% of simulations fall

### 6.3 Interpreting the Chart

**Good Strategy**:
- Generally upward equity curve
- Manageable drawdowns (<30%)
- Consistent profitability across simulations
- Wide confidence interval is acceptable for new strategies

**Red Flags**:
- Declining equity curve
- Drawdowns >50% (risk of ruin)
- High volatility between runs
- 95% confidence includes significant losses

### 6.4 Export Simulation Data

Click **"Export to CSV"** to download:
- Detailed trade-by-trade results
- Equity curve data points
- Statistical metrics
- Importable into Excel/Google Sheets for further analysis

---

## Step 7: Save and Export Your Strategy

### 7.1 Save to Dashboard

1. Click **"Save"** button (top right)
2. Enter strategy name: "EMA Crossover v1"
3. Add optional description
4. Click **"Save"**

**Storage Options**:
- **Signed In**: Saves to Supabase cloud database
- **Mock Mode**: Saves to browser LocalStorage

### 7.2 Download MQL5 File

1. In **Code** tab, click **"Download .mq5"**
2. File saves as `strategy_name.mq5`
3. Copy file to your MetaTrader 5 folder:
   - Windows: `C:\Program Files\MetaTrader 5\MQL5\Experts\`
   - Mac: `/Applications/MetaTrader 5.app/Contents/MacOS/MQL5/Experts/`

### 7.3 Import/Export Database

**Backup Your Work**:
1. Go to **Dashboard**
2. Click **"Export Database"**
3. Saves as JSON file with all strategies

**Restore from Backup**:
1. Click **"Import Database"**
2. Select JSON backup file
3. All strategies restored

---

## Step 8: Deploy to MetaTrader 5 (Optional)

### 8.1 Compile the Strategy

1. Open MetaTrader 5
2. Open **MetaEditor** (press F4)
3. File → Open → Select your .mq5 file
4. Click **"Compile"** (F7)
5. Verify no compilation errors

### 8.2 Enable Auto Trading

1. In MetaTrader 5 main window
2. Click **"Auto Trading"** button (or press `Alt + T`)
3. Allow DLL imports (if required by strategy)
4. Enable algorithmic trading in terminal

### 8.3 Attach Strategy to Chart

1. Drag and drop .mq5 file onto EURUSD chart
2. Adjust parameters in input dialog
3. Click **"OK"**
4. Strategy now runs on live market data

**Safety First**:
- **Test on Demo Account First**
- Start with minimum lot size (0.01)
- Monitor closely for first 20-50 trades
- Set maximum daily loss limit
- Never risk more than you can afford to lose

---

## Example: Complete Workflow

Let's create a complete strategy from start to finish:

### 1. Define Strategy Goal
"Create a conservative trend-following strategy for EURUSD H1 timeframe"

### 2. Write AI Prompt
```
Create a trend-following strategy using ADX (Average Directional Index) for trend strength
and EMA crossovers for entry signals. 

Parameters:
- 20 EMA (fast)
- 50 EMA (slow)
- 14 ADX for trend filter
- ADX threshold of 25 to confirm trend
- 50 pip stop loss
- 100 pip take profit

Entry rules:
- Buy: Fast EMA crosses above Slow EMA AND ADX > 25
- Sell: Fast EMA crosses below Slow EMA AND ADX > 25

Only trade when ADX confirms strong trend.
```

### 3. Generate and Review
- AI generates MQL5 code
- Review code in **Code** tab
- Verify logic matches requirements

### 4. Configure Settings
- Symbol: EURUSD
- Timeframe: H1
- Risk: 2% per trade
- Add custom ADX threshold input (default: 25)

### 5. Analyze Risk
- Check risk score
- Review AI's profitability assessment
- Verify risk/reward ratio is 1:2

### 6. Backtest
- Initial deposit: $10,000
- 1000 simulated trades
- 100 Monte Carlo iterations
- Review equity curve and statistics

### 7. Export and Test
- Save strategy as "ADX Trend Follower v1"
- Download .mq5 file
- Test in MetaTrader 5 demo account

### 8. Monitor and Refine
- Run on demo account for 1-2 months
- Track performance metrics
- Refine parameters if needed
- Deploy to live account only if profitable

---

## Tips for Success

### For Beginners

1. **Start Simple**: Basic moving average or breakout strategies
2. **Risk Management**: Never risk >2% per trade
3. **Backtest Thoroughly**: Run at least 1000 simulated trades
4. **Test on Demo**: Never go live without demo testing
5. **Keep Records**: Track all trades and analyze patterns

### For Intermediate Traders

1. **Combine Indicators**: Use multiple indicators for confirmation
2. **Optimize Parameters**: Systematically test different parameter values
3. **Filter Market Conditions**: Avoid low volatility or news events
4. **Monitor Drawdown**: Set maximum acceptable drawdown limit
5. **Diversify**: Test multiple strategies on different pairs

### For Advanced Traders

1. **Custom Coding**: Manually edit MQL5 for complex logic
2. **Portfolio Approach**: Deploy multiple uncorrelated strategies
3. **Machine Learning**: Incorporate ML models for signals
4. **Risk Parity**: Balance position sizes across strategies
5. **Continuous Optimization**: Regularly re-optimize parameters

---

## Common Mistakes to Avoid

### ❌ Over-Optimization
**Problem**: Tuning parameters too much for historical data
**Solution**: Use robust parameters that work across different timeframes

### ❌ Ignoring Risk Management
**Problem**: Risking >5% per trade
**Solution**: Always risk 1-3% per trade, maximum 5%

### ❌ Testing Only One Scenario
**Problem**: Single backtest without Monte Carlo simulation
**Solution**: Run 100+ Monte Carlo iterations to assess robustness

### ❌ Live Trading Without Demo Testing
**Problem**: Deploying directly to live account
**Solution**: Always test on demo account for 1-2 months first

### ❌ Ignoring Market Conditions
**Problem**: Trading strategy works only in trending markets
**Solution**: Add market condition filters (ADX, volatility, etc.)

### ❌ Not Monitoring Performance
**Problem**: Set and forget approach
**Solution**: Monitor trades weekly, analyze performance metrics

---

## Getting Help

### Documentation

- **[README](../README.md)**: Project overview and setup
- **[Service Architecture](SERVICE_ARCHITECTURE.md)**: Technical details
- **[Blueprint](blueprint.md)**: System architecture
- **[Coding Standards](../coding_standard.md)**: Development guidelines

### AI Prompting Tips

- **Be Specific**: Define exact parameters and rules
- **Use Examples**: "Like X strategy but with Y modification"
- **Iterate**: Start simple, then add complexity
- **Ask Questions**: "What do you think about adding X?"
- **Request Explanations**: "Explain why you chose these parameters"

### Troubleshooting

- **[Troubleshooting Guide](../README.md#troubleshooting)**: Common issues and solutions
- **Check Console**: Browser DevTools for errors
- **Review Code**: Check generated MQL5 for logic errors
- **Re-prompt**: Ask AI to fix specific issues

---

## Next Steps

After creating your first strategy:

1. **Create Multiple Strategies**: Test different approaches (trend, reversal, breakout)
2. **Build a Portfolio**: Combine uncorrelated strategies
3. **Optimize Parameters**: Systematically find best parameter values
4. **Paper Trade**: Test on demo account with live data
5. **Track Performance**: Maintain a trading journal
6. **Continuous Learning**: Study market dynamics and improve strategies

---

## Safety Warning

⚠️ **Trading involves substantial risk of loss.**

- **Never trade with money you cannot afford to lose**
- **Past performance does not guarantee future results**
- **Backtesting is not a guarantee of live performance**
- **Market conditions change unpredictably**
- **Always use proper risk management**
- **Test thoroughly on demo accounts first**
- **Consider professional financial advice**

QuantForge AI generates code and provides analysis, but you are solely responsible for trading decisions and outcomes.

---

**Happy Trading! 🚀**