# QuantForge AI Coding Standards

## 1. General Principles

*   **KISS (Keep It Simple, Stupid)**: Avoid over-engineering. Solves the problem at hand with the simplest standard solution.
*   **DRY (Don't Repeat Yourself)**: Extract common logic into helper functions or hooks.
*   **SRP (Single Responsibility Principle)**: Components should do one thing well.
*   **Safety First**: Always handle errors explicitly, especially with JSON parsing and API calls.

## 2. TypeScript & React

*   **Functional Components**: Use `React.FC<Props>` for all components.
*   **Hooks**: Extract complex state logic (effects, large reducers) into custom hooks (e.g., `useGeneratorLogic`).
*   **Types**:
    *   Define interfaces in `types.ts` if shared across multiple files.
    *   Use explicit types instead of `any` whenever possible.
    *   Enum values should be UPPER_CASE (e.g., `MessageRole.USER`).
*   **Naming**:
    *   Components: `PascalCase` (e.g., `CodeEditor.tsx`).
    *   Functions/Variables: `camelCase` (e.g., `handleSave`, `isLoading`).
    *   Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_SETTINGS`).

## 3. Styling (Tailwind CSS)

*   **Dark Mode**: The application is "Dark Mode First". Use specific color tokens defined in `tailwind.config` in `index.html`.
*   **Colors**:
    *   Use `bg-dark-bg` for main backgrounds.
    *   Use `bg-dark-surface` for cards/panels.
    *   Use `border-dark-border` for separators.
    *   Use `text-brand-400` or `500` for primary accents.
*   **Structure**: Use Flexbox (`flex`, `flex-col`) for layouts. Avoid absolute positioning unless necessary (e.g., overlays).

## 4. State Management

*   **Local State**: Use `useState` for UI-specific toggles (modals, tabs).
*   **Global State**: Use React Context only for global singletons (`ToastProvider`, `AuthProvider`).
*   **Data Persistence**: All critical data (`Robots`, `Settings`) must be persisted to LocalStorage (via `mockDb` or `settingsManager`) to survive page reloads.

## 5. Security

*   **API Keys**: Never hardcode keys in the source. Use `process.env` or user input stored in LocalStorage.
*   **Output Sanitization**: When rendering AI output, ensure HTML/Scripts are not executed. (The app uses simple text rendering or specific markdown parsers, avoiding `dangerouslySetInnerHTML` where possible).

## 6. AI Prompt Engineering

*   **System Prompts**: Defined in `constants.ts`.
*   **Constraints**: Prompts must explicitly enforce "Complete Code" to prevent "Lazy Coding" (e.g., `// ... rest of logic`).
*   **Context**: Always strip duplicate/redundant history before sending to the LLM to save tokens.
