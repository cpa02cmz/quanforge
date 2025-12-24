# Contributing to QuantForge AI

Thank you for your interest in contributing to QuantForge AI! This guide will help you understand how to contribute effectively to the project.

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Contribution Guidelines](#contribution-guidelines)
6. [Testing Requirements](#testing-requirements)
7. [Pull Request Process](#pull-request-process)
8. [Community Guidelines](#community-guidelines)

---

## Getting Started

### Prerequisites
- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher
- **Git**: Latest stable version
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### Development Tools
- **VS Code**: Recommended IDE with available extensions
- **TypeScript**: For type safety and better development experience
- **Git**: For version control and collaboration

---

## Development Setup

### 1. Fork and Clone
```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/quanforge.git
cd quanforge
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Configure your environment variables
# See .env.example for required variables
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Verify Setup
- Open http://localhost:5173 in your browser
- Ensure all features are working correctly
- Run `npm run typecheck` to verify TypeScript compilation
- Run `npm run build` to ensure production build works

---

## Project Structure

### Key Directories
```
quanforge/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── services/          # Business logic and API calls
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── hooks/             # Custom React hooks
├── api/                   # Next.js API routes
├── docs/                  # Documentation
├── public/                # Static assets
├── utils/                 # Shared utilities
├── constants/             # Application constants
└── archive/               # Archived documentation
```

### Core Concepts
- **Components**: Reusable UI components with clear responsibilities
- **Services**: Business logic, API integrations, and data management
- **Utils**: Shared functions and utilities used across the application
- **Types**: TypeScript interfaces and type definitions
- **Constants**: Configuration values and application constants

---

## Coding Standards

### TypeScript Standards
- **Strict Mode**: Always use strict TypeScript settings
- **Type Safety**: Avoid `any` types unless absolutely necessary
- **Interfaces**: Use interfaces for object type definitions
- **Generics**: Use generics for reusable components and functions
- **Enums**: Use enums for related constants

### Code Style

#### Naming Conventions
```typescript
// Components: PascalCase
export const RobotCard: React.FC<RobotCardProps> = ({ robot }) => {
  // Component logic
};

// Functions/Variables: camelCase
const getUserSettings = async (userId: string) => {
  // Function logic
};

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// Types/Interfaces: PascalCase
interface RobotConfig {
  name: string;
  strategy: string;
  risk: number;
}

// Files: kebab-case
// robot-generator.tsx
// user-settings.ts
```

#### Component Structure
```typescript
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface ComponentProps {
  // Props definition
}

export const ComponentName: React.FC<ComponentProps> = ({
  prop1,
  prop2
}) => {
  // 1. State hooks
  const [state, setState] = useState(initialValue);
  
  // 2. Effect hooks
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // 3. Event handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // 4. Derived values
  const computedValue = useMemo(() => {
    // Computation
  }, [dependencies]);
  
  // 5. Render
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};

export default ComponentName;
```

### Import Organization
```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party libraries
import { toast } from 'react-hot-toast';
import { z } from 'zod';

// 3. Internal imports (absolute paths)
import { RobotCard } from '@/components/RobotCard';
import { generateRobot } from '@/services/robotService';
import { RobotConfig } from '@/types/robot';

// 4. Relative imports
import './ComponentName.css';
```

---

## Contribution Guidelines

### Types of Contributions

#### 🐛 Bug Reports
- Search existing issues before creating new ones
- Provide clear, descriptive title
- Include steps to reproduce
- Describe expected vs. actual behavior
- Include environment information

#### ✨ Feature Requests
- Check roadmap for planned features
- Provide clear use case and motivation
- Describe desired behavior
- Consider implementation approach

#### 📝 Documentation
- Fix typos and grammar
- Improve clarity and completeness
- Add examples and use cases
- Update outdated information

#### 🧹 Code Quality
- Improve existing code
- Add missing tests
- Refactor for better maintainability
- Optimize performance

### Before You Contribute

#### 1. Check Existing Work
- Search for related issues and pull requests
- Review documentation for existing solutions
- Check if feature fits project goals

#### 2. Plan Your Approach
- Understand the codebase structure
- Identify affected components and services
- Consider impact on existing functionality
- Plan testing strategy

#### 3. Create Issue (if needed)
- Create GitHub issue for larger changes
- Discuss approach with maintainers
- Get feedback before implementation

---

## Testing Requirements

### Testing Strategy
- **Unit Tests**: Individual functions and components
- **Integration Tests**: Component interactions and API calls
- **End-to-End Tests**: Complete user workflows
- **Performance Tests**: Bundle size and runtime performance

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

### Test Structure
```typescript
// tests/utils/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateRobotCode } from '@/services/robotService';
import { mockRobotConfig } from '@/tests/mocks/robotMock';

describe('Robot Service', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should generate valid MQL5 code', async () => {
    const config = mockRobotConfig();
    const result = await generateRobotCode(config);
    
    expect(result).toBeDefined();
    expect(result.code).toContain('void OnInit()');
    expect(result.code).toContain('void OnTick()');
  });

  it('should handle invalid configurations', async () => {
    const invalidConfig = { /* invalid data */ };
    
    await expect(generateRobotCode(invalidConfig))
      .rejects.toThrow('Invalid configuration');
  });
});
```

### Test Coverage
- Aim for >80% coverage on critical paths
- Test both success and error scenarios
- Include edge cases and boundary conditions
- Mock external dependencies

---

## Pull Request Process

### 1. Create Branch
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or fix branch
git checkout -b fix/issue-description
```

### 2. Make Changes
- Follow coding standards
- Add tests for new functionality
- Update documentation
- Commit frequently with clear messages

### 3. Commit Guidelines
```bash
# Format: type(scope): description
git commit -m "feat(generator): add RSI indicator support"
git commit -m "fix(api): resolve timeout issue in robot generation"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(cache): improve performance monitoring"
```

#### Commit Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

### 4. Quality Checks
```bash
# Run all checks before PR
npm run typecheck    # TypeScript compilation
npm run lint         # Code linting
npm run test         # Test suite
npm run build        # Production build
```

### 5. Submit Pull Request
- Use descriptive title
- Link related issues
- Describe changes clearly
- Include screenshots for UI changes
- Add testing information

### 6. PR Template
```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Cross-browser testing done

## Checklist
- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console errors
- [ ] Performance impact considered
```

---

## Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume good intentions
- Prioritize project health over personal preferences

### Communication
- Use GitHub issues for bugs and features
- Join discussions in pull requests
- Ask questions in issues or discussions
- Share knowledge and help others

### Recognition
- Credit contributors in changelog
- Thank reviewers and helpers
- Celebrate milestones and achievements
- Recognize valuable contributions

---

## Getting Help

### Documentation Resources
- [README.md](./README.md) - Project overview
- [USER_GUIDE.md](./USER_GUIDE.md) - User documentation
- [blueprint.md](./blueprint.md) - Technical architecture
- [coding_standard.md](./coding_standard.md) - Detailed coding standards

### Support Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and community discussion
- **Pull Requests**: Code review and collaboration

### Common Issues
Check [bug.md](./bug.md) for known issues and solutions before creating new issues.

---

## Recognition and Impact

### Contributor Types
- **Core Contributors**: Regular, high-quality contributions
- **Active Contributors**: Frequent participation and feedback
- **Occasional Contributors**: Valuable contributions when available
- **Community Supporters**: Documentation, testing, and feedback

### Impact Areas
- **Features**: New functionality and capabilities
- **Performance**: Speed, efficiency, and reliability improvements
- **Documentation**: Better guides and explanations
- **Community**: Support, feedback, and knowledge sharing
- **Quality**: Testing, bug fixes, and code improvements

---

## Thank You!

Every contribution to QuantForge AI helps make the platform better for everyone. Whether you're fixing a bug, adding a feature, improving documentation, or helping others, your efforts are valued and appreciated.

Together, we're building the best AI-powered trading robot generation platform!

---

**Last Updated**: December 21, 2025  
**Maintainers**: QuantForge AI Team  
**License**: See LICENSE file for details