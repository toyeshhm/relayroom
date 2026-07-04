export const MANAGED_START = "<!-- relayroom:start -->";
export const MANAGED_END = "<!-- relayroom:end -->";

export function adapterBlock(toolName = "this AI coding tool") {
  return `${MANAGED_START}
## Relayroom Context

Before starting work in ${toolName}, read \`.relayroom/HANDOFF.md\`.

Use Relayroom as the shared project memory when switching between Claude Code, Cursor, Codex, or another agent:

- Start with \`relayroom resume ${toolName.toLowerCase().split(" ")[0]} --print\` when you need the current handoff prompt.
- Add durable facts with \`relayroom note "what changed and why"\`.
- Before pausing or switching tools, run \`relayroom capture --task "short task name" --note "current state"\`.

Do not paste secrets, tokens, or private keys into Relayroom notes or captures.
${MANAGED_END}`;
}

export function cursorRule() {
  return `---
description: Keep AI coding context synchronized with Relayroom
alwaysApply: true
---

# Relayroom Context

Read \`.relayroom/HANDOFF.md\` before making changes.

Use \`relayroom resume cursor --print\` to get the current handoff prompt, \`relayroom note "fact"\` to preserve durable context, and \`relayroom capture --task "task" --note "state"\` before switching tools.

Never write secrets into Relayroom files.
`;
}

export function initialNotes(projectName) {
  return `# ${projectName} Relayroom

Durable context goes here: product decisions, constraints, tradeoffs, open questions, and facts the next agent should not have to rediscover.

## Notes

- Relayroom initialized. Add the first useful fact with \`relayroom note "fact"\`.
`;
}

export function initialHandoff(projectName) {
  return `# Relayroom Handoff: ${projectName}

No capture has been created yet.

Run:

\`\`\`sh
relayroom capture --task "describe the task" --note "where the work stands"
relayroom resume codex --print
\`\`\`
`;
}
