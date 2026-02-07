# Planning Skill

## Purpose

The Planning skill helps agents break down complex tasks into manageable, actionable steps. It follows the agent-skill methodology from https://github.com/sulhi-sabil/agent-skill.

## When to Use

Use this skill when:
- Starting a new feature or major enhancement
- Refactoring large portions of code
- Implementing complex multi-step workflows
- Creating migration strategies

## Planning Process

### 1. Task Analysis

First, understand the scope:
```
- What is the goal?
- What are the constraints?
- What are the dependencies?
- What are the risks?
```

### 2. Break Down into Steps

Create atomic, actionable tasks:
- Each task should be completable in 5-15 minutes
- Tasks should have clear success criteria
- Dependencies between tasks should be explicit
- Group related tasks into phases

### 3. Define Verification Criteria

For each step, define:
- What constitutes "done"?
- How to verify correctness?
- What tests should pass?
- What documentation should be updated?

### 4. Resource Allocation

Assign:
- Which agent/model is best suited?
- What tools are needed?
- What external resources are required?

## Planning Template

```markdown
## Plan: [Task Name]

### Overview
- Goal: [Clear statement of what we're achieving]
- Priority: [High/Medium/Low]
- Estimated Time: [Total hours/days]

### Prerequisites
- [ ] List dependencies
- [ ] Required setup
- [ ] Access/permissions needed

### Phase 1: [Phase Name]
**Goal**: [What this phase accomplishes]

1. [ ] Task 1 - [5-15 min]
   - Details
   - Verification

2. [ ] Task 2 - [5-15 min]
   - Details
   - Verification

### Phase 2: [Phase Name]
...

### Verification Checklist
- [ ] All tests pass
- [ ] Code review completed
- [ ] Documentation updated
- [ ] No regressions

### Rollback Plan
If issues arise:
1. Steps to revert
2. Data backup strategy
3. Communication plan
```

## Integration with Other Skills

### With Test-Driven Development
Plan should include:
- Test design phase before implementation
- Verification steps for each task

### With Brainstorming
Use brainstorming for:
- Exploring alternative approaches
- Identifying edge cases
- Gathering requirements

### With Subagent-Driven Development
Planning enables:
- Clear task boundaries for subagents
- Parallel execution of independent tasks
- Progress tracking across agents

## Best Practices

1. **Start Small**: Begin with MVP, iterate
2. **Be Specific**: Vague plans lead to vague results
3. **Include Verification**: Every task needs a success metric
4. **Plan for Failure**: Include error handling and rollback
5. **Update as You Go**: Plans are living documents

## Example Plans

See the task.md file in the repository root for examples of planning in action.

## External Reference

Based on: https://github.com/sulhi-sabil/agent-skill/tree/main/planning