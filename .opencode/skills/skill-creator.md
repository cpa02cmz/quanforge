# Skill Creator

## Purpose

The Skill Creator skill helps agents develop new skills following best practices. This enables the system to be extended with domain-specific capabilities.

## When to Create a New Skill

Create a new skill when:
- You find yourself repeating similar instructions
- A specific workflow needs standardization
- You want to codify expert knowledge
- You're onboarding new agents to a domain

## Skill Structure

Every skill should follow this structure:

```markdown
# Skill Name

## Purpose

Brief description of what this skill does and when to use it.

## When to Use

Specific conditions that trigger this skill.

## [Main Content]

The actual instructions, patterns, or workflows.

## Examples

Concrete examples of using this skill.

## Integration

How this skill works with other skills.

## External Reference

Link to source if adapted from another repository.
```

## Skill Creation Process

### 1. Identify the Need

Ask:
- What problem does this solve?
- Is there an existing skill that covers this?
- Will this be used multiple times?

### 2. Define the Scope

Decide:
- What's in scope?
- What's out of scope?
- What are the boundaries?

### 3. Gather Content

Collect:
- Patterns from your codebase
- Best practices from documentation
- Examples of good vs bad approaches

### 4. Write the Skill

Follow the template above. Be:
- **Clear**: Unambiguous instructions
- **Specific**: Concrete examples
- **Complete**: Cover edge cases
- **Concise**: No fluff

### 5. Test the Skill

Verify:
- It triggers correctly
- Instructions are clear
- Examples work as described
- Integration with other skills works

### 6. Iterate

Improve based on:
- Usage feedback
- New patterns discovered
- Changes in the codebase

## Skill Guidelines

### Naming
- Use descriptive names: `database-optimization`, not `db-opt`
- Use kebab-case
- Be specific: `supabase-connection`, not just `database`

### Location
- Place in `.opencode/skills/`
- Use `.md` extension
- Keep skills focused (one per file)

### Length
- Aim for 100-500 lines
- Shorter is better
- Split complex skills into multiple files

### Dependencies
- Document required skills
- Note optional integrations
- List conflicting skills

## Integration Points

### With Hooks
Skills can be triggered by:
- `user_prompt_submit`
- `pre_tool_use`
- `post_tool_use`

### With Agents
Assign skills to specific agents:
- Security skills → Security agent
- Frontend skills → Frontend agent
- Database skills → Backend agent

### With Context
Skills can inject context:
- Relevant files
- Configuration
- Examples

## Example: Creating a Security Skill

```markdown
# Security Audit Skill

## Purpose

Perform comprehensive security audits on code changes.

## When to Use

- Before merging to main
- After adding new dependencies
- When handling sensitive data
- Quarterly security reviews

## Audit Checklist

1. Check for secrets in code
2. Review dependency vulnerabilities
3. Validate input sanitization
4. Check authentication flows
5. Review access controls

## Integration

Works with:
- test-driven-development
- github-workflow-automation

## External Reference

Based on: https://github.com/sulhi-sabil/agent-skill
```

## Skill Registry

Keep track of your skills:

```markdown
## Skills Inventory

### Core Skills
- brainstorming
- writing-plans
- planning
- test-driven-development

### Domain Skills
- database-optimization
- security-audit
- performance-profiling

### Workflow Skills
- github-workflow-automation
- systematic-debugging
- skill-creator
```

## External Reference

Based on: https://github.com/sulhi-sabil/agent-skill/tree/main/skill-creator