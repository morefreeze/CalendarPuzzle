# OpenSpec Agent Instructions

This file guides AI assistants in using OpenSpec for spec-driven development.

## Core Principles

1. **Agree before you build** - Always confirm understanding with the user before writing code
2. **Stay organized** - Each change gets its own folder in `openspec/changes/`
3. **Work fluidly** - Update any artifact anytime, no rigid phase gates

## Workflow

### Creating a Change

When a user requests a new feature or change:

1. Create a new folder in `openspec/changes/` with a descriptive name
2. Generate the following artifacts:
   - `proposal.md` - Why we're doing this, what's changing
   - `specs/` - Requirements and scenarios
   - `design.md` - Technical approach
   - `tasks.md` - Implementation checklist

3. Present the proposal to the user for review
4. Only proceed with implementation after user approval

### Implementing Tasks

1. Work through tasks in `tasks.md` sequentially
2. Mark each task as complete as you finish it
3. Update artifacts if requirements change during implementation
4. Test thoroughly before marking implementation complete

### Archiving

When a change is complete:

1. Move the change folder to `openspec/changes/archive/`
2. Update any relevant documentation
3. Clean up temporary files

## Slash Commands

- `/opsx:new <description>` - Create a new change
- `/opsx:continue` - Continue to the next artifact
- `/opsx:apply` - Implement the tasks
- `/opsx:archive` - Archive the completed change

## File Structure

```
openspec/
├── agents.md          # This file - instructions for AI assistants
├── project.md         # Project context and metadata
└── changes/
    ├── <change-name>/
    │   ├── proposal.md
    │   ├── specs/
    │   ├── design.md
    │   └── tasks.md
    └── archive/
        └── <date>-<change-name>/
```

## Best Practices

- Keep proposals concise but complete
- Use clear, descriptive names for changes
- Update artifacts as you learn more during implementation
- Always test before marking tasks complete
- Communicate blockers or issues immediately
