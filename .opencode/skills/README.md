# OpenCode Skills for QuanForge

This directory contains specialized skills for the OpenCode CLI to enhance development workflows.

## Available Skills

### 1. Brainstorming (`brainstorming.md`)
**Trigger**: Before writing code  
**Purpose**: Refine ideas through Socratic questioning, explore alternatives, validate design  
**Based on**: obra/superpowers brainstorming skill

### 2. Test-Driven Development (`test-driven-development.md`)
**Trigger**: During implementation  
**Purpose**: Enforce RED-GREEN-REFACTOR cycle  
**Based on**: obra/superpowers TDD skill

### 3. Systematic Debugging (`systematic-debugging.md`)
**Trigger**: When investigating bugs  
**Purpose**: 4-phase root cause analysis  
**Based on**: obra/superpowers systematic-debugging skill

### 4. Writing Plans (`writing-plans.md`)
**Trigger**: After design approval  
**Purpose**: Create detailed implementation plans  
**Based on**: obra/superpowers writing-plans skill

### 5. GitHub Workflow Automation (`github-workflow-automation.md`)
**Trigger**: Managing branches/PRs  
**Purpose**: Automate GitHub workflows including /ulw-loop  
**Based on**: sulhi-sabil/agent-skill

### 6. Planning (`planning.md`)
**Trigger**: Starting new features or complex tasks  
**Purpose**: Break down tasks into actionable steps with verification criteria  
**Based on**: sulhi-sabil/agent-skill planning skill

### 7. Skill Creator (`skill-creator.md`)
**Trigger**: Developing new agent capabilities  
**Purpose**: Create new skills following best practices and integration patterns  
**Based on**: sulhi-sabil/agent-skill skill-creator

## How to Use

Skills are automatically loaded by OpenCode based on context. You can also invoke them explicitly:

```
/brainstorming [your idea]
/tdd [feature description]
/debug [issue description]
/plan [task description]
/ulw-loop
/create-skill [skill concept]
```

Or mention the skill in your prompt:
- "Use brainstorming to explore this architecture"
- "Apply systematic debugging to this error"
- "Create a plan for implementing X"
- "Use test-driven development for this feature"

## Configuration

Skills are configured in:
- `.opencode/oh-my-opencode.json`: Main configuration
- `opencode.json`: Project-level settings

## Adding New Skills

1. Create a new `.md` file in this directory
2. Follow the format: Trigger, Purpose, Workflow, Examples
3. Update this README
4. Add skill to `oh-my-opencode.json` if needed

## Integration with External Repositories

These skills are adapted from:
- **oh-my-opencode**: Agent harness and orchestration
- **superpowers**: Software development methodology
- **agent-skill**: GitHub workflow automation

Skills are customized for QuanForge's specific context:
- TypeScript/React/Vite stack
- AI-powered code generation
- Trading strategy development
- Security and performance focus

## References

- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
- [superpowers](https://github.com/obra/superpowers)
- [agent-skill](https://github.com/sulhi-sabil/agent-skill)
