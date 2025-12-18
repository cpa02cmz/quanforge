# QuantForge AI - Agent Documentation

This document provides essential context for AI agents working on the QuantForge codebase to ensure efficient and accurate assistance.

## Repository Overview

QuantForge AI is a React + TypeScript application that generates MQL5 trading robots using natural language descriptions. The core value proposition is bridging the gap between user intent and executable trading code.

## Architecture Principles

### Core Design Patterns
- **Adapter Pattern**: Supabase service with localStorage fallback
- **Observer Pattern**: Market data simulation with pub/sub
- **Singleton**: Global services (market data, toast notifications)
- **Functional Components**: React.FC with hooks for state management

### Key Directories Structure
```
src/
├── components/          # React UI components
├── services/           # Business logic and API integrations
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types.ts            # TypeScript type definitions
├── constants.ts        # Application constants and prompts
api/                    # Edge API routes (Vercel Edge Functions)
pages/                  # React Router page components
```

## Critical Services

### AI Generation (`services/gemini.ts`)
- Integrates with Google Gemini AI (`gemini-3-pro-preview`)
- Context construction with strategy constraints
- Robust parsing for MQL5 code extraction
- Error handling and retry logic

### Persistence (`services/supabase.ts`)
- Dual mode: Supabase (production) / localStorage (development)
- Robot entities with code, params, chat history, analysis
- Pagination and query optimization for large datasets

### Market Simulation (`services/marketData.ts`)
- Real-time price updates every 1000ms
- Brownian motion with volatility clustering
- Virtual order book for major currency pairs

## Component Patterns

### State Management Strategy
- **Global State**: Auth session, toast notifications (React Context)
- **Page State**: Generator.tsx manages robot editing state
- **Local State**: UI toggles, form inputs (useState)

### Key Components
- **Generator.tsx**: Main controller for robot creation/editing
- **ChatInterface.tsx**: AI conversation interface
- **CodeEditor.tsx**: MQL5 syntax highlighting and editing
- **StrategyConfig.tsx**: Strategy parameter configuration
- **MarketTicker.tsx**: Real-time price display

## Coding Standards

### TypeScript Conventions
- Use `React.FC<Props>` for all components
- Explicit types instead of `any`
- Interfaces in `types.ts` for shared types
- Enum values in `UPPER_CASE`

### Naming Conventions
- Components: `PascalCase.tsx`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: kebab-case for utilities, PascalCase for components

### Styling Guidelines
- Dark mode first design
- Tailwind CSS utility classes
- Flexbox layouts (`flex`, `flex-col`)
- Specific color tokens: `bg-dark-bg`, `bg-dark-surface`, `text-brand-400`

## Security Considerations

### API Key Management
- Never hardcode API keys
- Use `process.env` for server-side
- LocalStorage for user-provided keys
- Key rotation support in AI settings

### Input Sanitization
- XSS prevention in user inputs
- Safe JSON parsing with error handling
- Filename sanitization for downloads
- Prompt engineering constraints for AI

## Performance Optimizations

### React Optimizations
- React.memo for expensive components
- Custom hooks for complex state logic
- Lazy loading for translations and strategies
- Bundle splitting with Vite

### Database Optimizations
- Pagination for large datasets
- Query-level filtering and indexing
- Request deduplication for AI calls
- Connection pooling for Supabase

## Testing Strategy

### Current Setup
- Vitest for unit testing
- React Testing Library for component tests
- Coverage reporting available
- Performance testing configuration

### Key Test Areas
- AI service integration
- Component rendering and interactions
- Database operations
- Error handling scenarios

## Common Workflows

### Adding New Features
1. Define types in `types.ts` if shared
2. Create component in `components/`
3. Add service logic in `services/`
4. Extract complex logic to custom hook
5. Update documentation as needed

### Debugging Common Issues
- Check `constants.ts` for prompt configurations
- Verify API key rotation logic
- Review Supabase connection settings
- Check market data simulation updates

## Deployment

### Build Commands
- `npm run build`: Standard production build
- `npm run build:edge`: Edge-optimized build
- `npm run typecheck`: TypeScript validation
- `npm run lint`: ESLint validation

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase connection
- `VITE_SUPABASE_ANON_KEY`: Supabase authentication
- AI provider keys (Google Gemini, etc.)

## Recent Improvements

### Version 1.3 Enhancements
- Database pagination implementation
- Query optimization with indexing
- Request deduplication for performance
- Extended component memoization
- Standardized error handling patterns

### Code Quality Improvements
- Enhanced TypeScript typing
- React performance optimizations
- Security hardening
- Bundle size optimization
- Error boundary implementation

## Agent Guidelines

### When Making Changes
1. Follow established patterns and conventions
2. Add proper TypeScript types
3. Include error handling
4. Update relevant documentation
5. Test before committing

### Security First Approach
- Never expose sensitive data
- Sanitize all user inputs
- Use environment variables for secrets
- Validate all external data

### Performance Considerations
- Use React.memo for expensive renders
- Implement proper loading states
- Optimize bundle size impact
- Consider edge runtime constraints

This document should be updated whenever significant architectural changes occur or new patterns are established.