# Architecture Overview

## Folder Structure

- **`/components`**: Reusable UI components.
    - `Layout.tsx`: App shell (Sidebar, Header).
    - `CodeEditor.tsx`: Advanced text editor with PrismJS and line numbers.
    - `ChatInterface.tsx`: UI for AI conversation.
    - `StrategyConfig.tsx`: Form for editing `StrategyParams`.
    - `MarketTicker.tsx`: Real-time data visualization.
    - `Toast.tsx`: Global notification context.
- **`/hooks`**: Custom React Hooks.
    - `useGeneratorLogic.ts`: Encapsulates state and business logic for the Generator page.
- **`/pages`**: Route-level components.
    - `Dashboard.tsx`: List, filter, and management of robots.
    - `Generator.tsx`: Main workspace coordinating Chat, Settings, Editor, and Services.
- **`/services`**: External integrations.
    - `gemini.ts`: Handles prompt construction, API calls to Google GenAI, and JSON parsing.
    - `supabase.ts`: Abstracted Database layer. Switches between Real Supabase SDK and Mock (LocalStorage) implementation based on env vars.
    - `marketData.ts`: Singleton service using the Observer pattern to publish simulated tick data.
- **`/` Root**:
    - `App.tsx`: Routing (React Router) and Auth state management.
    - `types.ts`: Central TypeScript definitions.
    - `constants.ts`: System prompts and static lists.

## Data Flow

1.  **User Action**: User types a prompt in `Generator.tsx`.
2.  **Service Call**: `generateMQL5Code` (in `gemini.ts`) is called with the Prompt, Current Code, Strategy Config, and Chat History.
3.  **AI Processing**: Gemini generates a response.
4.  **Parsing**: The response is parsed.
    - If code block found -> Updates `code` state.
    - Text -> Updates `messages` state.
5.  **Persistence**: When "Save" is clicked, `mockDb.saveRobot` stores the entire state (Code, Params, Chat, Analysis) to Supabase or LocalStorage.

## Key Decisions

- **Mock DB**: Implemented to ensure the app is playable immediately without requiring user backend setup.
- **Hooks Abstraction**: Complex generator state is moved to `useGeneratorLogic` to keep the UI component clean and testable.
- **Pips vs Points**: The UI exposes "Pips" (user-friendly), but the AI prompt enforces conversion to "Points" (MQL5 standard) to prevent logic errors in generated code.
- **Performance Optimizations**: 
  - Token budgeting in AI context building to efficiently manage conversation history
  - Pre-calculated arrays and optimized loops in Monte Carlo simulation for faster backtesting
  - Improved caching with validation and better hash generation in strategy analysis
  - Efficient array operations in database updates to reduce unnecessary iterations
  - **Supabase Connection Pooling**: Retry logic with exponential backoff for resilient database connections
  - **Response Caching**: Client-side caching for frequently accessed data with TTL management
  - **Code Splitting**: Automatic chunking for optimal loading performance
  - **Lazy Loading**: Components loaded on-demand to reduce initial bundle size
- **PrismJS**: Loaded via CDN in `index.html` to avoid heavy build-step configuration for a lightweight demo.
- **Vercel Optimization**: 
  - Edge-ready configuration for global CDN distribution
  - Security headers for production deployment
  - Optimized build process with proper chunking strategies
  - Performance monitoring integration for production insights