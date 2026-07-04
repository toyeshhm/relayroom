import { execFileSync } from "node:child_process";
import { addNote, createSnapshot, exportPack, initRelayroom, installAdapters, renderResume, status } from "./core.js";

function parse(argv) {
  const args = [...argv];
  const command = args.shift() || "help";
  const flags = {};
  const positionals = [];
  while (args.length) {
    const arg = args.shift();
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[0];
      flags[key] = next && !next.startsWith("--") ? args.shift() : true;
    } else {
      positionals.push(arg);
    }
  }
  return { command, flags, positionals };
}

function help() {
  return `Relayroom keeps context portable between Claude Code, Cursor, Codex, and other AI coding agents.

Usage:
  relayroom init
  relayroom adapters install
  relayroom note "Durable fact the next agent should know"
  relayroom capture --task "Build auth flow" --note "Tests pass; OAuth callback still open"
  relayroom resume [codex|claude|cursor|generic] --print
  relayroom pack --agent codex --out handoff.md
  relayroom status

Core idea:
  .relayroom/HANDOFF.md is the shared source of truth.
  AGENTS.md, CLAUDE.md, and Cursor rules point each tool at that same file.
`;
}

function maybeCopy(text) {
  try {
    execFileSync("pbcopy", { input: text });
    return true;
  } catch {
    return false;
  }
}

export async function runCli(argv) {
  const { command, flags, positionals } = parse(argv);

  if (command === "help" || flags.help) {
    console.log(help());
    return;
  }

  if (command === "init") {
    const result = initRelayroom();
    console.log(`Relayroom initialized at ${result.roomDir}`);
    return;
  }

  if (command === "adapters" && positionals[0] === "install") {
    const result = installAdapters();
    console.log(`Installed Relayroom adapters:\n${result.touched.map((path) => `- ${path}`).join("\n")}`);
    return;
  }

  if (command === "note") {
    const result = addNote(positionals.join(" "));
    console.log(`Added note to ${result.notesPath}`);
    return;
  }

  if (command === "capture") {
    const result = createSnapshot({ task: flags.task || "", note: flags.note || "" });
    console.log(`Captured ${result.snapshot.id}`);
    console.log(`Updated ${result.handoffPath}`);
    return;
  }

  if (command === "resume") {
    const agent = positionals[0] || flags.agent || "generic";
    const text = renderResume(agent);
    if (flags.copy) {
      const copied = maybeCopy(text);
      console.log(copied ? "Copied Relayroom resume prompt to clipboard." : text);
      return;
    }
    if (flags.print || !flags.copy) {
      console.log(text);
      return;
    }
  }

  if (command === "pack") {
    const result = exportPack({ agent: flags.agent || "generic", out: flags.out });
    console.log(`Wrote ${result.out}`);
    return;
  }

  if (command === "status") {
    const result = status();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${help()}`);
}
