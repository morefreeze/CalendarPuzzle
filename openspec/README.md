# OpenSpec

This directory contains the OpenSpec configuration for spec-driven development.

## Directory Structure

```
openspec/
├── agents.md          # Instructions for AI assistants
├── project.md         # Project context and metadata
└── changes/
    ├── <change-name>/  # Active changes
    └── archive/        # Completed changes
```

## Getting Started

To create a new change, tell your AI assistant:

```
/opsx:new <description of what you want to build>
```

The assistant will create a new folder in `openspec/changes/` with:
- `proposal.md` - Why we're doing this, what's changing
- `specs/` - Requirements and scenarios
- `design.md` - Technical approach
- `tasks.md` - Implementation checklist

## Workflow

1. **Create** - Use `/opsx:new` to start a new change
2. **Review** - Review the proposal and provide feedback
3. **Implement** - Use `/opsx:apply` to implement the tasks
4. **Archive** - Use `/opsx:archive` to archive completed changes

## Learn More

Visit [OpenSpec on GitHub](https://github.com/Fission-AI/OpenSpec) for more information.
