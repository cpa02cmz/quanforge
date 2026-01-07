
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

### Quick Start

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/quanforge.git
    cd quanforge
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and configure:

    **Required**:
    ```bash
    VITE_API_KEY=your_google_gemini_api_key_here
    ```

    **Optional (for cloud data persistence)**:
    ```bash
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

    **Optional (for real-time market data)**:
    ```bash
    VITE_TWELVE_DATA_API_KEY=your_twelve_data_api_key
    ```

    **Note**: If Supabase keys are missing, the app defaults to a robust LocalStorage mock mode for development.

### Supabase Setup Guide

#### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Configure your project:
   - **Name**: `quantforge-ai` (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose a region closest to your users
   - **Pricing Plan**: Free tier is sufficient for development

4. Wait for project initialization (1-2 minutes)

#### Step 2: Get Supabase Credentials

1. Navigate to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon/public key**: The long string under "Project API keys"
3. Add these to your `.env.local` file:
   ```bash
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

#### Step 3: Set Up Database Schema

The application requires a `robots` table. Run the following SQL in the Supabase **SQL Editor**:

```sql
-- Create robots table
CREATE TABLE robots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  strategy_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  strategy_params JSONB DEFAULT '{}',
  chat_history JSONB DEFAULT '[]',
  analysis_result JSONB DEFAULT '{}',
  backtest_settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  CONSTRAINT robots_user_name_unique UNIQUE (user_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_robots_user_id ON robots(user_id);
CREATE INDEX idx_robots_created_at ON robots(created_at DESC);
CREATE INDEX idx_robots_strategy_type ON robots(strategy_type);

-- Enable Row Level Security
ALTER TABLE robots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own robots"
  ON robots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own robots"
  ON robots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own robots"
  ON robots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own robots"
  ON robots FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Public robots are viewable by everyone"
  ON robots FOR SELECT
  USING (is_public = true);
```

#### Step 4: Configure Authentication

1. Navigate to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Configure email templates if needed (optional)
4. Disable phone auth if not needed (recommended for simplicity)

#### Step 5: Test Connection

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open the application in your browser
3. Try to create a new robot
4. If successful, check Supabase **Table Editor** to verify data was saved

### Mock Mode (Development Only)

If you don't want to set up Supabase, the application automatically uses LocalStorage mock mode:

**Benefits**:
- No external dependencies
- Instant setup (just run `npm run dev`)
- All features work except multi-device sync
- Data persists in browser storage

**Limitations**:
- Data not shared across devices
- Lost if browser cache is cleared
- No real-time collaboration
- No backup unless manually exported

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
  - **Database Performance**: Optimized indexing, materialized views, and caching mechanisms for large datasets
  - **Vercel Edge Optimization**: Edge-optimized deployment with global CDN distribution and enhanced caching
  - **Supabase Integration**: Advanced connection pooling and query optimization for database operations
  - **Real-time Monitoring**: Performance and security monitoring with alerting capabilities
  - **SEO Enhancement**: Comprehensive SEO optimization for better search engine visibility

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

## Troubleshooting

### Common Issues

#### Build Fails with TypeScript Errors

**Problem**: TypeScript compilation errors during build
```bash
npm run build
```

**Solutions**:
- Check TypeScript version: `npm list typescript`
- Run type check first: `npm run typecheck`
- Clear node_modules and reinstall:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```
- Check for missing dependencies in package.json

#### Supabase Connection Errors

**Problem**: "Supabase connection failed" or "Auth session missing"

**Solutions**:
- Verify environment variables are set correctly:
  ```bash
  echo $VITE_SUPABASE_URL
  echo $VITE_SUPABASE_ANON_KEY
  ```
- Check Supabase project is active (not paused)
- Verify RLS policies allow operations:
  ```sql
  -- Check RLS is enabled
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public';

  -- Check your RLS policies
  SELECT * FROM pg_policies WHERE tablename = 'robots';
  ```
- Test Supabase connection in browser console:
  ```javascript
  const { createClient } = supabase;
  const client = createClient(YOUR_URL, YOUR_KEY);
  const { data, error } = await client.from('robots').select('*');
  console.log(data, error);
  ```
- Fallback: Remove Supabase env vars to use LocalStorage mock mode

#### AI Generation Fails

**Problem**: "AI generation failed" or API errors

**Solutions**:
- Verify `VITE_API_KEY` is valid:
  ```bash
  echo $VITE_API_KEY
  ```
- Check Google Cloud Console for API key status
- Verify Gemini models are enabled:
  1. Go to [Google AI Studio](https://aistudio.google.com)
  2. Check your API key has access to `gemini-3-pro-preview` or `gemini-2.5-flash`
- Check API quota: Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
- Check browser console for specific error messages
- Test API key manually:
  ```bash
  curl -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=$VITE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
  ```

#### Market Data Not Updating

**Problem**: Market ticker shows static or no data

**Solutions**:
- Market data is **simulated** (not real-time by default)
- For real-time data, configure `VITE_TWELVE_DATA_API_KEY`
- Check browser console for errors
- Verify marketData service is initialized:
  ```javascript
  import { marketData } from './services';
  marketData.subscribe('EURUSD', (quote) => console.log(quote));
  ```

#### Application Won't Start

**Problem**: `npm run dev` fails or shows errors

**Solutions**:
- Check Node.js version (requires Node 18+):
  ```bash
  node --version
  ```
- Clear cache and reinstall:
  ```bash
  rm -rf .vite dist node_modules
  npm install
  ```
- Check port 3000 is not in use:
  ```bash
  # On Linux/Mac
  lsof -i :3000
  # On Windows
  netstat -ano | findstr :3000
  ```
- Try different port:
  ```bash
  npm run dev -- --port 3001
  ```

#### Data Not Persisting

**Problem**: Robots disappear after page refresh

**Solutions**:
- **LocalStorage Full**: Clear browser cache or export/delete some robots
- **LocalStorage Disabled**: Check browser privacy settings
- **Supabase Auth Issue**: User session expired - re-authenticate
- Check browser console for quota errors:
  ```javascript
  // Test localStorage
  try {
    localStorage.setItem('test', 'value');
    console.log('LocalStorage working');
  } catch (e) {
    console.error('LocalStorage disabled:', e);
  }
  ```

### Environment Issues

#### `.env.local` Not Loading

**Problem**: Environment variables not available in application

**Solutions**:
- Ensure file is named `.env.local` (not `.env.example`)
- Restart development server after changing env vars
- Check `.gitignore` includes `.env.local` (don't commit secrets!)
- Access env vars with `import.meta.env.VITE_*` in Vite apps
- Verify variables start with `VITE_` prefix (Vite requirement)

### Performance Issues

#### Slow Build Times

**Problem**: Build takes >30 seconds

**Solutions**:
- Disable source maps in development:
  ```javascript
  // vite.config.ts
  export default defineConfig({
    build: {
      sourcemap: false
    }
  });
  ```
- Clear Vite cache:
  ```bash
  rm -rf .vite
  ```
- Update dependencies:
  ```bash
  npm update
  ```
- Check for large dependencies:
  ```bash
  npm run build -- --mode analyze
  ```

#### Application Laggy

**Problem**: UI responds slowly to interactions

**Solutions**:
- Check browser DevTools Performance tab
- Disable non-essential features in settings
- Clear application cache
- Update browser to latest version
- Check system resources (CPU/Memory usage)

### Deployment Issues

#### Vercel Deployment Fails

**Problem**: Build fails on Vercel

**Solutions**:
- Check build logs in Vercel dashboard
- Verify environment variables in Vercel settings
- Ensure `vercel.json` exists and is valid
- Test locally: `npm run build` (must succeed before deploying)
- Check Node.js version compatibility:
  ```json
  // package.json
  "engines": {
    "node": ">=18.0.0"
  }
  ```
- Review [AGENTS.md](AGENTS.md) for deployment troubleshooting patterns

#### Environment Variables Not Available in Production

**Problem**: App works locally but fails on Vercel

**Solutions**:
- Add all environment variables to Vercel dashboard
- Ensure variable names match (case-sensitive)
- Prefix with `VITE_` for client-side access
- Re-deploy after adding environment variables
- Check Vercel build logs for missing variable warnings

### Getting Help

1. **Check Documentation**:
   - [Service Architecture](docs/SERVICE_ARCHITECTURE.md) - Service layer details
   - [Blueprint](docs/blueprint.md) - System architecture
   - [Coding Standards](coding_standard.md) - Development guidelines

2. **Check Issues**:
   - Search existing GitHub issues
   - Review [AGENTS.md](AGENTS.md) for known problems and solutions

3. **Debug Mode**:
   - Enable detailed logging:
     ```typescript
     localStorage.setItem('debug', 'true');
     ```
   - Check browser console for errors
   - Use browser DevTools Network tab for API issues

4. **Minimal Reproduction**:
   - Create minimal reproduction case
   - Check if issue persists in clean environment:
     ```bash
     git clone https://github.com/your-repo/quanforge.git
     cd quanforge
     npm install
     npm run dev
     ```

## Additional Resources

- **Vite Documentation**: https://vitejs.dev/
- **React Documentation**: https://react.dev/
- **Supabase Documentation**: https://supabase.com/docs
- **Google AI Studio**: https://aistudio.google.com/
- **Tailwind CSS**: https://tailwindcss.com/docs