import { claudeRunner } from "./claude.ts";
import { codexRunner } from "./codex.ts";
import { antigravityRunner } from "./antigravity.ts";
import { opencodeRunner } from "./opencode.ts";
import { scriptRunner } from "./script.ts";
import type { Runner } from "./runner.ts";

export const RUNNERS: Record<string, Runner> = {
  claude: claudeRunner,
  codex: codexRunner,
  antigravity: antigravityRunner,
  opencode: opencodeRunner,
  script: scriptRunner,
};

export const DEFAULT_RUNNER = "claude";
