# Technical Writer Guidelines

## Overview

This document provides comprehensive guidelines for technical writers contributing to QuantForge AI documentation. Following these standards ensures consistency, clarity, and maintainability across all project documentation.

## Documentation Philosophy

### Core Principles

1. **Clarity Over Cleverness**: Write for comprehension, not to impress
2. **Progressive Disclosure**: Simple explanations first, depth when needed
3. **Show, Don't Tell**: Use examples, code snippets, and visuals
4. **Audience Awareness**: Different documentation for different users
5. **Maintainability**: Structure that enables easy updates

### Documentation Types

| Type | Audience | Purpose | Example |
|------|----------|---------|---------|
| **User Guide** | End Users | How to use the application | QUICK_START.md |
| **Architecture** | Developers | System design and patterns | SERVICE_ARCHITECTURE.md |
| **API Reference** | Developers | Interface specifications | (See service docs) |
| **Troubleshooting** | All Users | Problem resolution | README.md#troubleshooting |
| **Contributing** | Contributors | How to contribute | CONTRIBUTING.md |

## Writing Standards

### Language and Tone

- **Use active voice**: "Click the button" not "The button should be clicked"
- **Be direct**: Avoid "please", "we recommend", "it is suggested"
- **Use second person**: Address the reader directly ("you")
- **Be concise**: Remove unnecessary words and phrases
- **Define terms**: First use of technical terms should include brief definition

**Good Example**:
```
Clone the repository and install dependencies:

```bash
git clone https://github.com/cpa02cmz/quanforge.git
cd quanforge
npm install
```
```

**Bad Example**:
```
We recommend that you please clone the repository first. It is suggested that you then install the dependencies. The dependencies are necessary for the application to function properly.
```

### Formatting Standards

#### Headers
- Use sentence case for headers ("Getting started", not "Getting Started")
- Use proper header hierarchy (don't skip levels)
- Keep headers concise but descriptive

#### Code Blocks
- Specify language for syntax highlighting
- Keep examples focused and runnable
- Include expected output when helpful

```markdown
**Good**:
```typescript
const robot = await db.getRobot(id);
console.log(robot.name);
```

**Bad**:
```
Get robot and log it
```
```

#### Lists
- Use bullet points for unordered items
- Use numbered lists for sequential steps
- Keep list items parallel in structure

#### Links
- Use descriptive link text (avoid "click here")
- Prefer relative links for internal docs
- Use absolute URLs for external resources

**Examples**:
```markdown
**Good**: See the [Service Architecture documentation](./SERVICE_ARCHITECTURE.md)
**Bad**: Click [here](./SERVICE_ARCHITECTURE.md) for more info

**Good**: Visit [Supabase documentation](https://supabase.com/docs)
**Bad**: https://supabase.com/docs
```

## Document Structure

### Standard Sections

#### 1. Title and Overview
```markdown
# Document Title

Brief description (1-2 sentences) explaining what this document covers and who it's for.
```

#### 2. Prerequisites (if applicable)
```markdown
## Prerequisites

- Required software/versions
- Required knowledge
- Required access/permissions
```

#### 3. Main Content
Organize by logical sections with clear progression

#### 4. Examples (if applicable)
```markdown
## Examples

### Example 1: Basic Usage
...

### Example 2: Advanced Usage
...
```

#### 5. Troubleshooting (if applicable)
```markdown
## Troubleshooting

### Issue: [Problem description]
**Solution**: [Step-by-step fix]

### Issue: [Another problem]
**Solution**: [Another fix]
```

#### 6. References
```markdown
## References

- [Related Document 1](./doc1.md)
- [Related Document 2](./doc2.md)
- [External Resource](https://example.com)
```

## Common Patterns

### Feature Documentation
```markdown
## Feature Name

**Purpose**: One sentence describing what this feature does

**When to Use**: When/why users should use this feature

**How to Use**:
1. Step one
2. Step two
3. Step three

**Configuration Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | string | "default" | Description |

**Example**:
```typescript
// Code example showing feature usage
```
```

### API Documentation
```markdown
## Function/Method Name

**Signature**: `functionName(param1: Type, param2?: Type): ReturnType`

**Description**: What this function does

**Parameters**:
- `param1` (Type): Description
- `param2` (Type, optional): Description

**Returns**: Description of return value

**Throws**: Any errors that might be thrown

**Example**:
```typescript
const result = functionName("value");
```

**See Also**: Related functions or documentation
```

### Troubleshooting Entry
```markdown
### Issue: [Clear problem statement]

**Symptoms**:
- Symptom 1
- Symptom 2

**Cause**: Brief explanation of root cause

**Solution**:
1. Step one
2. Step two
3. Step three

**Prevention**: How to avoid this issue
```

## Code Examples

### Principles
1. **Runnable**: Examples should actually work when copied
2. **Complete**: Include all necessary imports/setup
3. **Realistic**: Use realistic values and scenarios
4. **Tested**: Verify examples work before publishing

### TypeScript/React Examples
```markdown
**Good**:
```typescript
import { db } from './services';

// Get all robots for current user
const robots = await db.getRobots();
console.log(`Found ${robots.length} robots`);
```

**Bad**:
```typescript
// Incomplete, won't work
getRobots().then(r => console.log(r));
```
```

### SQL Examples
```markdown
**Good**:
```sql
-- Check RLS policies for robots table
SELECT * FROM pg_policies WHERE tablename = 'robots';
```

**Bad**:
```sql
-- Vague and incomplete
SELECT * FROM table
```
```

## Review Checklist

Before submitting documentation changes, verify:

### Content
- [ ] Information is accurate and up-to-date
- [ ] All code examples are tested and working
- [ ] No placeholder text or TODOs remain
- [ ] Technical terms are defined on first use
- [ ] Steps are clear and actionable

### Formatting
- [ ] Proper Markdown syntax throughout
- [ ] Code blocks have language specifications
- [ ] Headers follow hierarchy (no skipped levels)
- [ ] Lists are properly formatted
- [ ] Tables are readable in raw Markdown

### Links
- [ ] All internal links use relative paths
- [ ] All external links are valid
- [ ] Link text is descriptive
- [ ] Images have alt text (if applicable)

### Style
- [ ] Active voice used consistently
- [ ] Second person ("you") used throughout
- [ ] Consistent terminology
- [ ] No grammar or spelling errors
- [ ] Concise writing without filler words

## Common Errors to Fix

### Typos and Spelling
- Variable names in code examples must match actual code
- Technical terms must be spelled correctly
- Consistent capitalization (e.g., "Supabase" not "supabase")

### Broken Links
- Check all links before publishing
- Update links when files are moved or renamed
- Use relative links for internal documentation

### Outdated Information
- Remove references to deprecated features
- Update version numbers and requirements
- Update screenshots when UI changes

### Inconsistent Formatting
- Use consistent code block languages
- Maintain consistent header styles
- Standardize list formatting

## Specific Guidelines for This Project

### File Naming
- Use UPPERCASE for multi-word filenames: `QUICK_START.md`
- Use descriptive names: `SERVICE_ARCHITECTURE.md` not `ARCH.md`
- Keep files in appropriate directories:
  - `docs/` for technical documentation
  - Root for user-facing docs (README.md, CONTRIBUTING.md)

### Repository References
- Always use actual repository URL: `https://github.com/cpa02cmz/quanforge`
- Never use placeholder URLs in user-facing docs
- Update all references if repository moves

### Environment Variables
- Always prefix with `VITE_` for client-side variables
- Document all required variables in Prerequisites
- Provide examples in code blocks

### Version References
- Specify version numbers for dependencies
- Note when features were added/changed
- Maintain changelog for significant changes

## Maintenance

### Regular Updates
- Review docs quarterly for accuracy
- Update when features change
- Fix broken links immediately

### Version Control
- Commit documentation with related code changes
- Use descriptive commit messages
- Tag significant documentation updates

### Feedback Loop
- Monitor user questions for doc gaps
- Update based on common issues
- Improve clarity based on user feedback

## Examples of Good Documentation

### From This Project

**QUICK_START.md** - Excellent user guide with:
- Clear step-by-step instructions
- Multiple examples for different scenarios
- Visual aids where helpful
- Safety warnings appropriately placed

**SERVICE_ARCHITECTURE.md** - Excellent technical doc with:
- Comprehensive architecture overview
- Clear service descriptions
- Usage examples for each service
- Troubleshooting section

**README.md#troubleshooting** - Excellent troubleshooting with:
- Organized by issue type
- Clear symptoms and solutions
- Code examples for diagnostics
- Multiple solution approaches

## Anti-Patterns to Avoid

❌ **Walls of text** without structure or breaks
❌ **Vague instructions** like "do the thing"
❌ **Untested code** examples that don't work
❌ **Inconsistent terminology** ("app" vs "application")
❌ **Missing context** - assuming reader knows background
❌ **Outdated information** - stale screenshots, old APIs
❌ **Placeholder content** - "TODO", "FIXME", "coming soon"

## Tools and Resources

### Recommended Tools
- **Markdown Editor**: VS Code with Markdown extensions
- **Link Checker**: Use `markdown-link-check` or similar
- **Spell Checker**: Built-in or extensions
- **Preview**: VS Code Markdown preview or similar

### Helpful Resources
- [Microsoft Writing Style Guide](https://docs.microsoft.com/en-us/style-guide/welcome/)
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [MDN Web Docs Writing Guidelines](https://developer.mozilla.org/en-US/docs/MDN/Guidelines/Writing_style_guide)

## Quick Reference

### Markdown Cheat Sheet
```markdown
# Header 1
## Header 2
### Header 3

**Bold text**
*Italic text*
`Inline code`

```typescript
// Code block
const x = 1;
```

- Bullet point
- Another point

1. Numbered step
2. Next step

[Link text](url)
![Alt text](image-url)

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
```

### Common Replacements
| Instead of | Use |
|------------|-----|
| "It is suggested that" | (Remove) |
| "We recommend" | (Remove or use imperative) |
| "Please" | (Remove) |
| "Click here" | Descriptive link text |
| "Just" | (Remove) |
| "Simply" | (Remove) |
| "Very" | (Remove or use stronger word) |

---

**Document Maintenance**: This guide should be updated when new documentation patterns emerge or standards evolve.

**Last Updated**: 2026-02-07
