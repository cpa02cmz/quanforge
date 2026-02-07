# System Prompts Reference

## Overview

This directory contains reference materials from the [system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) repository - a collection of extracted system prompts from popular chatbots like ChatGPT, Claude, and Gemini.

## Purpose

Use these prompts as reference for:
- Understanding how major AI systems structure their prompts
- Improving prompt engineering for agent interactions
- Learning best practices from production-grade prompts
- Crafting better instructions for specialized agents

## Available References

### Anthropic (Claude)
System prompts and developer messages from Claude models
- Behavioral guidelines
- Safety protocols
- Tool use instructions

### OpenAI (ChatGPT/GPT)
System prompts from GPT models
- Conversation handling
- Safety guardrails
- Tool integration patterns

### Google (Gemini)
System prompts from Gemini models
- Multimodal handling
- Response formatting
- Safety constraints

### Perplexity
Search-augmented generation prompts
- Query understanding
- Source citation formatting

### xAI (Grok)
System prompts from Grok models
- Conversational style
- Real-time information handling

### Proton
Privacy-focused AI prompts
- Data handling guidelines
- Security protocols

### Misc
Other notable system prompts and patterns

## Best Practices for Agent Prompts

Based on the patterns found in this collection:

1. **Be Explicit**: Clear, unambiguous instructions work better than vague guidelines
2. **Structure Matters**: Use formatting (headers, lists) to organize complex instructions
3. **Safety First**: Include safety constraints and guardrails explicitly
4. **Examples Help**: Provide concrete examples of desired behavior
5. **Iterate**: Test and refine prompts based on actual usage

## Integration with QuanForge

This reference helps improve:
- Trading strategy generation prompts
- Code review agent instructions
- Documentation generation
- Security audit agent behavior

## External Repository

For the full collection, visit:
https://github.com/asgeirtj/system_prompts_leaks

## Usage Note

These prompts are for educational and reference purposes. When crafting prompts for your agents:
- Adapt patterns to your specific use case
- Don't copy-paste without understanding
- Test thoroughly with your domain
- Respect the original system's constraints

## Quick Reference Commands

When working with prompts:

```bash
# Search for specific prompt patterns
grep -r "pattern" .opencode/references/system_prompts_leaks/

# Compare different system approaches
# Look at Anthropic/claude.txt vs OpenAI/GPT/ for differences
```

## Last Updated

2026-02-07 - Integrated into QuanForge agent configuration