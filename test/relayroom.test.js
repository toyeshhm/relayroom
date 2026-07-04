import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNote, createSnapshot, initRelayroom, installAdapters, renderResume, status, upsertManagedBlock } from "../src/core.js";

function tempProject() {
  return mkdtempSync(join(tmpdir(), "relayroom-test-"));
}

test("init creates the shared context room", () => {
  const cwd = tempProject();
  const result = initRelayroom({ cwd, name: "demo" });
  assert.match(result.roomDir, /\.relayroom$/);
  assert.equal(status({ cwd }).initialized, true);
  assert.match(readFileSync(join(cwd, ".relayroom", "HANDOFF.md"), "utf8"), /No capture has been created/);
});

test("notes and capture produce a resume prompt", () => {
  const cwd = tempProject();
  addNote("API client moved to src/lib/api.ts", { cwd });
  createSnapshot({ cwd, task: "Wire API", note: "Need final smoke test" });
  const prompt = renderResume("codex", { cwd });
  assert.match(prompt, /Relayroom Resume Prompt for codex/);
  assert.match(prompt, /API client moved/);
  assert.match(prompt, /Need final smoke test/);
});

test("adapter install points each tool at the handoff", () => {
  const cwd = tempProject();
  const result = installAdapters({ cwd });
  assert.equal(result.touched.length, 3);
  assert.match(readFileSync(join(cwd, "AGENTS.md"), "utf8"), /\.relayroom\/HANDOFF\.md/);
  assert.match(readFileSync(join(cwd, "CLAUDE.md"), "utf8"), /Claude Code/);
  assert.match(readFileSync(join(cwd, ".cursor", "rules", "relayroom.mdc"), "utf8"), /alwaysApply: true/);
});

test("managed block replacement is idempotent", () => {
  const first = upsertManagedBlock("Intro", "<!-- relayroom:start -->\nA\n<!-- relayroom:end -->");
  const second = upsertManagedBlock(first, "<!-- relayroom:start -->\nB\n<!-- relayroom:end -->");
  assert.match(second, /Intro/);
  assert.match(second, /B/);
  assert.doesNotMatch(second, /A/);
});
