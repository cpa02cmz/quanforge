# Contributing to QuantForge AI

Thank you for your interest in contributing to QuantForge AI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Submitting Changes](#submitting-changes)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Questions and Support](#questions-and-support)

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git for version control
- Basic knowledge of TypeScript, React, and MQL5 (for trading strategy work)

### First Steps

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/quanforge.git
   cd quanforge
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/cpa02cmz/quanforge.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```
5. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Add your API keys to .env.local
   ```

---

## Development Setup

### Development Server

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build Commands

```bash
# Type checking
npm run typecheck

# Production build
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
quanforge/
├── components/        # React components
├── services/         # Business logic services
├── utils/            # Utility functions and helpers
├── types.ts          # TypeScript type definitions
├── App.tsx           # Main application component
├── main.tsx          # Application entry point
└── docs/             # Documentation files
```

---

## Code Style Guidelines

### TypeScript & React

- **Functional Components**: Use `React.FC<Props>` for all components
- **Hooks**: Extract complex state logic into custom hooks (e.g., `useGeneratorLogic`)
- **Types**:
  - Define interfaces in `types.ts` if shared across multiple files
  - Use explicit types instead of `any` whenever possible
  - Enum values should be UPPER_CASE (e.g., `MessageRole.USER`)

### Naming Conventions

- **Components**: `PascalCase` (e.g., `CodeEditor.tsx`)
- **Functions/Variables**: `camelCase` (e.g., `handleSave`, `isLoading`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_SETTINGS`)
- **Files**: `kebab-case` for utilities, `PascalCase` for components

### Code Quality Principles

1. **KISS (Keep It Simple)**: Avoid over-engineering
2. **DRY (Don't Repeat Yourself)**: Extract common logic into helpers
3. **SRP (Single Responsibility)**: Components should do one thing well
4. **Safety First**: Always handle errors explicitly (JSON parsing, API calls)

### Styling (Tailwind CSS)

- **Dark Mode First**: Use specific color tokens from `tailwind.config`
  - `bg-dark-bg` for main backgrounds
  - `bg-dark-surface` for cards/panels
  - `border-dark-border` for separators
- **Structure**: Use Flexbox (`flex`, `flex-col`) for layouts
- **Responsive**: Use responsive prefixes (`md:`, `lg:`) for mobile-first design

### Security Best Practices

- **No Hardcoded Secrets**: Never commit API keys or secrets
- **Environment Variables**: Use `import.meta.env.VITE_*` for client-side env vars
- **Input Sanitization**: Sanitize all user inputs (use `securityManager`)
- **XSS Prevention**: Avoid `dangerouslySetInnerHTML` unless necessary

---

## Submitting Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-new-indicator`
- `fix/ai-parsing-bug`
- `docs/update-readme`
- `refactor/optimize-caching`

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(generator): add Bollinger Bands indicator support

Fixes #123
```

```
fix(supabase): handle quota exceeded errors gracefully

- Added try-catch for localStorage operations
- Implemented automatic cache cleanup
- Shows user-friendly error message
```

### Pull Request Process

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes** following code style guidelines

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**:
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill in the PR template
   - Link related issues (e.g., "Fixes #123")

6. **Address review feedback**:
   - Respond to reviewer comments
   - Make requested changes
   - Push updates to your branch

### PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] Production build succeeds (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional format
- [ ] PR description explains changes clearly

---

## Testing Requirements

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

Tests should follow the AAA (Arrange-Act-Assert) pattern:

```typescript
describe('serviceName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something when condition is met', () => {
    // Arrange
    const input = { value: 123 };

    // Act
    const result = service.process(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Test Coverage

- Aim for >80% coverage for critical services
- Test both happy paths and error cases
- Mock external dependencies (API calls, localStorage)
- Include edge cases and boundary conditions

---

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new features
- Change existing behavior
- Fix breaking bugs
- Update APIs or interfaces
- Improve code organization

### Documentation Files

- **README.md**: Project overview, setup, and quick start
- **docs/QUICK_START.md**: User guide for creating trading strategies
- **docs/SERVICE_ARCHITECTURE.md**: Technical details of service layer
- **./blueprint.md**: System architecture and design
- **./docs/task.md**: Task tracking and completion status
- **coding_standard.md**: Code style and conventions

### Documentation Best Practices

- **Be Clear**: Use simple, concise language
- **Be Accurate**: Ensure docs match current implementation
- **Provide Examples**: Show working code examples
- **Keep Updated**: Remove outdated information
- **Structure for Scanning**: Use headings, lists, and emphasis

---

## Development Workflow

### Feature Development

1. Create feature branch from main
2. Implement changes following guidelines
3. Write tests for new functionality
4. Update documentation if needed
5. Run tests and build to verify
6. Submit PR with clear description

### Bug Fixing

1. Create branch with descriptive name (`fix/issue-description`)
2. Write test that reproduces the bug
3. Implement fix
4. Verify test passes
5. Check for similar issues in codebase
6. Submit PR with issue reference

### Refactoring

1. Create branch (`refactor/improve-component-name`)
2. Ensure tests pass before refactoring
3. Make incremental changes
4. Run tests after each change
5. Update documentation if API changes
6. Submit PR explaining improvements

---

## Questions and Support

### Getting Help

1. **Search existing issues**: Check if your question has been addressed
2. **Read documentation**: Review README.md and docs/ folder
3. **Ask in issues**: Create a GitHub issue with:
   - Clear title
   - Detailed description
   - Steps to reproduce (for bugs)
   - Environment information (OS, Node.js version, browser)

### Issue Reporting

When reporting bugs, include:

- **Description**: What happened?
- **Steps to Reproduce**: How can we reproduce the issue?
- **Expected Behavior**: What should have happened?
- **Actual Behavior**: What actually happened?
- **Environment**:
  - OS: [e.g., Ubuntu 22.04, macOS 14, Windows 11]
  - Node.js version: `node --version`
  - Browser: [e.g., Chrome 120, Firefox 121]
- **Screenshots/Logs**: If applicable

### Feature Requests

When suggesting features, include:

- **Problem**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives**: What alternatives did you consider?
- **Additional Context**: Any other relevant information?

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of:

- Age
- Body size
- Disability
- Ethnicity
- Gender identity and expression
- Level of experience
- Nationality
- Personal appearance
- Race
- Religion
- Sexual identity and orientation

### Our Standards

Positive behavior includes:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy toward other community members

Unacceptable behavior includes:

- Harassment, trolling, or derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing private information without permission
- Any other conduct which could reasonably be considered inappropriate

### Reporting

If you witness or experience unacceptable behavior, please:

1. Contact the project maintainers privately
2. Include details of the incident
3. We will review and take appropriate action

---

## Recognition

Contributors will be recognized in:

- **Contributors section of README.md**
- **Release notes for their contributions**
- **Project documentation**

All contributors are valuable to the success of QuantForge AI!

---

## License

By contributing to QuantForge AI, you agree that your contributions will be licensed under the project's license.

---

**Thank you for contributing to QuantForge AI! 🚀**
