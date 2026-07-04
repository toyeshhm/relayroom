import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { adapterBlock, cursorRule, initialHandoff, initialNotes, MANAGED_END, MANAGED_START } from "./templates.js";

const ROOM_DIR = ".relayroom";

export function roomPath(cwd = process.cwd(), ...parts) {
  return join(cwd, ROOM_DIR, ...parts);
}

export function projectName(cwd = process.cwd()) {
  return basename(resolve(cwd)) || "project";
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function readText(path, fallback = "") {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

export function writeText(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value, "utf8");
}

export function initRelayroom(options = {}) {
  const cwd = options.cwd || process.cwd();
  const name = options.name || projectName(cwd);
  ensureDir(roomPath(cwd, "snapshots"));
  ensureDir(roomPath(cwd, "packs"));

  const configPath = roomPath(cwd, "config.json");
  if (!existsSync(configPath)) {
    writeText(configPath, JSON.stringify({
      schema: 1,
      project: name,
      defaultAgent: "generic",
      createdAt: new Date().toISOString(),
      capture: {
        includeDiffStat: true,
        includeRecentCommits: true,
        includeUntrackedFiles: true
      }
    }, null, 2) + "\n");
  }

  const notesPath = roomPath(cwd, "notes.md");
  if (!existsSync(notesPath)) writeText(notesPath, initialNotes(name));

  const handoffPath = roomPath(cwd, "HANDOFF.md");
  if (!existsSync(handoffPath)) writeText(handoffPath, initialHandoff(name));

  const ignorePath = roomPath(cwd, ".gitignore");
  if (!existsSync(ignorePath)) writeText(ignorePath, "packs/*.local.md\n*.secret.md\n");

  return { roomDir: roomPath(cwd), configPath, notesPath, handoffPath };
}

export function addNote(text, options = {}) {
  if (!text || !text.trim()) throw new Error("Provide a note, for example: relayroom note \"Auth now uses Supabase.\"");
  const cwd = options.cwd || process.cwd();
  initRelayroom({ cwd });
  const notesPath = roomPath(cwd, "notes.md");
  const entry = `\n### ${new Date().toISOString()}\n\n- ${text.trim()}\n`;
  writeText(notesPath, readText(notesPath) + entry);
  return { notesPath };
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function getGitState(cwd) {
  const inside = git(cwd, ["rev-parse", "--is-inside-work-tree"]) === "true";
  if (!inside) return { available: false };
  const untracked = git(cwd, ["ls-files", "-o", "--exclude-standard"]).split("\n").filter(Boolean);
  return {
    available: true,
    branch: git(cwd, ["branch", "--show-current"]) || "(detached)",
    head: git(cwd, ["rev-parse", "--short", "HEAD"]),
    statusShort: git(cwd, ["status", "--short"]),
    diffStat: git(cwd, ["diff", "--stat"]),
    stagedDiffStat: git(cwd, ["diff", "--cached", "--stat"]),
    recentCommits: git(cwd, ["log", "--oneline", "-5"]),
    untrackedFiles: untracked.slice(0, 40)
  };
}

function detectPackage(cwd) {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) return null;
  try {
    const pkg = JSON.parse(readText(packagePath));
    return {
      name: pkg.name || null,
      version: pkg.version || null,
      scripts: pkg.scripts || {}
    };
  } catch {
    return null;
  }
}

function fingerprint(cwd) {
  const source = `${resolve(cwd)}:${readText(join(cwd, "package.json"), "")}:${git(cwd, ["rev-parse", "--show-toplevel"])}`;
  return createHash("sha256").update(source).digest("hex").slice(0, 12);
}

export function createSnapshot(options = {}) {
  const cwd = options.cwd || process.cwd();
  const init = initRelayroom({ cwd });
  const createdAt = new Date().toISOString();
  const id = createdAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  const snapshot = {
    schema: 1,
    id,
    createdAt,
    project: projectName(cwd),
    root: resolve(cwd),
    fingerprint: fingerprint(cwd),
    task: options.task || "",
    note: options.note || "",
    git: getGitState(cwd),
    package: detectPackage(cwd)
  };
  const snapshotPath = roomPath(cwd, "snapshots", `${id}.json`);
  writeText(snapshotPath, JSON.stringify(snapshot, null, 2) + "\n");
  writeText(init.handoffPath, renderHandoff(snapshot, readText(roomPath(cwd, "notes.md"))));
  writeGlobalIndex(snapshot, snapshotPath);
  return { snapshot, snapshotPath, handoffPath: init.handoffPath };
}

function writeGlobalIndex(snapshot, snapshotPath) {
  const indexPath = join(homedir(), ".relayroom", "projects.json");
  let index = {};
  try {
    index = JSON.parse(readText(indexPath, "{}"));
  } catch {
    index = {};
  }
  index[snapshot.fingerprint] = {
    project: snapshot.project,
    root: snapshot.root,
    latestSnapshot: snapshotPath,
    updatedAt: snapshot.createdAt
  };
  writeText(indexPath, JSON.stringify(index, null, 2) + "\n");
}

export function latestSnapshot(cwd = process.cwd()) {
  const dir = roomPath(cwd, "snapshots");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
  if (!files.length) return null;
  const path = join(dir, files.at(-1));
  return JSON.parse(readText(path));
}

export function renderHandoff(snapshot, notesText = "") {
  const status = snapshot.git?.statusShort?.trim() || "clean";
  const packageScripts = snapshot.package?.scripts ? Object.keys(snapshot.package.scripts) : [];
  const gitLines = snapshot.git?.available ? [
    `- Branch: ${snapshot.git.branch}`,
    `- HEAD: ${snapshot.git.head}`,
    `- Working tree: ${status === "clean" ? "clean" : "has changes"}`,
    snapshot.git.diffStat ? `- Unstaged diff stat:\n\n\`\`\`text\n${snapshot.git.diffStat}\n\`\`\`` : "",
    snapshot.git.stagedDiffStat ? `- Staged diff stat:\n\n\`\`\`text\n${snapshot.git.stagedDiffStat}\n\`\`\`` : "",
    snapshot.git.untrackedFiles?.length ? `- Untracked files: ${snapshot.git.untrackedFiles.join(", ")}` : ""
  ].filter(Boolean).join("\n") : "- Git repository not detected.";

  return `# Relayroom Handoff: ${snapshot.project}

Captured: ${snapshot.createdAt}

## Current Task

${snapshot.task || "No task label provided."}

## Current State

${snapshot.note || "No state note provided."}

## Repository

${gitLines}

## Useful Commands

${packageScripts.length ? packageScripts.map((script) => `- npm run ${script}`).join("\n") : "- No package scripts detected."}

## Recent Commits

\`\`\`text
${snapshot.git?.recentCommits || "No recent commits detected."}
\`\`\`

## Durable Notes

${notesText.trim() || "No durable notes yet."}

## Resume Prompt

You are taking over this project from another AI coding tool. Read this handoff first, inspect the repo before editing, preserve unrelated user changes, and update Relayroom before switching away.
`;
}

export function renderResume(agent = "generic", options = {}) {
  const cwd = options.cwd || process.cwd();
  initRelayroom({ cwd });
  const handoff = readText(roomPath(cwd, "HANDOFF.md"));
  const agentAdvice = {
    codex: "Use AGENTS.md plus this handoff as the active operating context.",
    claude: "Use CLAUDE.md plus this handoff as the active operating context.",
    cursor: "Use the Cursor rule plus this handoff as the active operating context.",
    generic: "Use this handoff as the active operating context."
  }[agent] || "Use this handoff as the active operating context.";

  return `# Relayroom Resume Prompt for ${agent}

${agentAdvice}

${handoff}
`;
}

export function installAdapters(options = {}) {
  const cwd = options.cwd || process.cwd();
  initRelayroom({ cwd });
  const touched = [];
  const adapters = [
    ["AGENTS.md", adapterBlock("Codex")],
    ["CLAUDE.md", adapterBlock("Claude Code")]
  ];
  for (const [file, block] of adapters) {
    const path = join(cwd, file);
    writeText(path, upsertManagedBlock(readText(path), block));
    touched.push(path);
  }
  const cursorPath = join(cwd, ".cursor", "rules", "relayroom.mdc");
  writeText(cursorPath, cursorRule());
  touched.push(cursorPath);
  return { touched };
}

export function upsertManagedBlock(existing, block) {
  if (!existing.trim()) return `${block}\n`;
  const start = existing.indexOf(MANAGED_START);
  const end = existing.indexOf(MANAGED_END);
  if (start !== -1 && end !== -1 && end > start) {
    return `${existing.slice(0, start).trimEnd()}\n\n${block}\n${existing.slice(end + MANAGED_END.length).trimStart()}`;
  }
  return `${existing.trimEnd()}\n\n${block}\n`;
}

export function exportPack(options = {}) {
  const cwd = options.cwd || process.cwd();
  initRelayroom({ cwd });
  const agent = options.agent || "generic";
  const out = options.out || roomPath(cwd, "packs", `relayroom-${agent}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}.md`);
  const contents = renderResume(agent, { cwd });
  writeText(out, contents);
  return { out };
}

export function status(options = {}) {
  const cwd = options.cwd || process.cwd();
  const snapshot = latestSnapshot(cwd);
  return {
    initialized: existsSync(roomPath(cwd, "config.json")),
    roomDir: roomPath(cwd),
    latestSnapshot: snapshot?.createdAt || null,
    git: getGitState(cwd)
  };
}

export function assertExecutable(path) {
  const mode = statSync(path).mode;
  return Boolean(mode & 0o111);
}
