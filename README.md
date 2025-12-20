
# QuantForge AI - MQL5 Generator

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fproject-name%2Frepo-name)

QuantForge AI is a web-based platform that uses Google's Gemini 3.0/2.5 AI models to generate, analyze, and manage trading robots (Expert Advisors) for the MetaTrader 5 (MQL5) platform.

## Features

- **AI-Powered Code Generation**: Utilizes `gemini-3-pro-preview` for high-reasoning code generation and `gemini-2.5-flash` for rapid strategy analysis.
- **Interactive Chat**: Refine your trading strategies through a conversational interface.
- **Visual Strategy Configuration**: Adjust risk, stop loss (in Pips), take profit, and custom inputs via a GUI without touching code.
- **Custom System Prompts**: Define global instructions (e.g., coding style, language) that apply to every AI interaction.
- **Real-time Market Simulation**: View simulated price ticks and spreads for major pairs directly in the dashboard.
- **AI Strategy Simulation (Monte Carlo)**: Visualize projected Equity Curves, Drawdowns, and ROI based on the AI's risk/profit analysis without leaving the app.
- **Robust Editor**: Syntax highlighting (PrismJS), line numbers, and manual editing support.
- **Strategy Analysis**: Automatic risk scoring and profitability assessment with visual charts.
- **Data Persistence**: Save your robots, including chat history, configuration, and simulation settings using Supabase (or LocalStorage fallback).
- **Project Lifecycle**: Easily create new projects, duplicate existing ones, and manage versions with automated state resets.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS
- **AI**: Google GenAI SDK (`@google/genai`)
- **Backend/DB**: Supabase (Auth & Database)
- **Charts**: Recharts
- **Utils**: PrismJS (Syntax Highlighting)

## Getting Started

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and configure:
    *   `VITE_API_KEY`: Google Gemini API Key.
    *   `VITE_SUPABASE_URL`: (Optional) Your Supabase Project URL.
    *   `VITE_SUPABASE_ANON_KEY`: (Optional) Your Supabase Anon Key.
    *   `VITE_TWELVE_DATA_API_KEY`: (Optional) Twelve Data API for real-time market data.
    *   *Note: If Supabase keys are missing, the app defaults to a robust LocalStorage mock mode.*

## Development

```bash
# Start development server
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Vercel Deployment

The application is optimized for Vercel deployment with:

- **Automatic builds** via `vercel.json` configuration
- **Optimized bundling** with code splitting for better performance
- **Security headers** for production deployment
- **Edge-ready** configuration for global CDN distribution

To deploy to Vercel:

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

 ### Performance Optimizations

 - **Code Splitting**: Automatic chunking of vendor libraries, components, and pages
 - **Caching**: Intelligent caching strategy for Supabase queries and API responses
 - **Bundle Optimization**: Tree-shaking and minification for reduced bundle size
 - **Lazy Loading**: Components are loaded on-demand for faster initial load
 - **Performance Monitoring**: Built-in performance metrics collection
 - **Enhanced Security**: Advanced API key encryption with additional obfuscation layers
 - **Input Validation**: Comprehensive XSS protection and input sanitization across all user inputs
 - **Error Handling**: Improved error boundaries and global error capture
 - **Database Performance**: Optimized indexing and caching mechanisms for large datasets

## Development Status

✅ **Core Application**: Fully functional with authentication, strategy generation, and backtesting  
✅ **Performance Optimizations**: React.memo, code splitting, lazy loading implemented  
✅ **Security**: Environment variable protection, input validation, XSS prevention  
✅ **Database**: Advanced caching, query optimization, connection pooling  
✅ **SEO**: Comprehensive meta tags, structured data, sitemap generation  
✅ **Build Compatibility**: Browser-compatible modules, schema-compliant deployment configurations  
✅ **PR #136**: Vercel deployment schema issues resolved, ready for merge  
✅ **Cross-Platform Support**: All code tested for browser, Node.js, and edge environments

## Usage

1.  **Dashboard**: View all your created robots. Use the search bar to find specific bots or filter by strategy type.
2.  **Generator**:
    *   **Chat Tab**: Describe your strategy (e.g., "Create a Triple EMA crossover").
    *   **Settings Tab**: Fine-tune specific parameters like Stop Loss (Pips), Timeframe, and Symbol.
    *   **Code Editor**: View the generated code, copy it, or download the `.mq5` file.
    *   **Analysis**: Check the AI's estimation of risk and profit potential.
    *   **Simulation**: Run a Monte Carlo simulation to project how the strategy might perform over time given its risk profile.

## Development Principles

- **KISS**: Keep components simple. Complex logic (like AI parsing) is separated into services.
- **Separation of Concerns**: Business logic for the generator is encapsulated in `hooks/useGeneratorLogic.ts`.
- **Offline First**: The `services/supabase.ts` module ensures the app is fully functional without a backend connection for demo purposes.
- **Performance Optimized**: Services are optimized for performance with efficient token budgeting, caching, and array operations.
- **Type Safety**: strict TypeScript interfaces are defined in `types.ts`.
