import { ParseErrors } from "./diagnostics";

export const DEFAULT_RELAY_CONTEXT = 3;

export type RelayLineRange = { start: number; end: number | null };

export type GitHost = "gitlab" | "github" | "unknown";
export type RelayMode = "code" | "diff";

export interface GitRelaySpec {
  repo: string;
  path: string;
  lang: string;
  host: GitHost;
  branch: string | null;
  commit: string | null; // commit takes precedence over branch
  lines: RelayLineRange;
  mode: RelayMode;
  context: number; // context is valid only in diff mode
  note: string | null;
}

export type ParseSpecResult =
  | { ok: true; spec: GitRelaySpec }
  | { ok: false; error: string };

export function detectGitHost(repo: string): GitHost {
  if (repo.includes("gitlab.com")) {
    return "gitlab";
  } else if (repo.includes("github.com")) {
    return "github";
  }

  return "unknown";
}

export function parseSpec(source: string): ParseSpecResult {
  const rawSpec: Partial<GitRelaySpec> = {};

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    switch (key) {
      case "repo":
        rawSpec.repo = val;
        break;
      case "branch":
        rawSpec.branch = val;
        break;
      case "lang":
        rawSpec.lang = val;
        break;
      case "commit":
        rawSpec.commit = val;
        break;
      case "path":
        rawSpec.path = val;
        break;
      case "mode": {
        if (val !== "code" && val !== "diff") {
          return {
            ok: false,
            error: ParseErrors.invalidMode(),
          };
        }

        rawSpec.mode = val;
        break;
      }
      case "context": {
        const context = parseInt(val, 10);

        if (Number.isNaN(context)) {
          return {
            ok: false,
            error: ParseErrors.invalidContext(),
          };
        }

        if (context < 0) {
          return {
            ok: false,
            error: ParseErrors.invalidContext(),
          };
        }

        rawSpec.context = context;
        break;
      }
      case "note":
        rawSpec.note = val;
        break;
      case "lines": {
        const match = val.match(/^(\d+)?-(\d+)?$/);

        if (!match) {
          return {
            ok: false,
            error: ParseErrors.invalidLinesFormat(),
          };
        }

        const [, startStr, endStr] = match;

        const start = startStr ? parseInt(startStr) : 1;
        const end = endStr ? parseInt(endStr) : null;

        if (end !== null && start > end) {
          return {
            ok: false,
            error: ParseErrors.invalidLineRange(),
          };
        }

        rawSpec.lines = { start, end };
        break;
      }
    }
  }

  if (!rawSpec.repo) {
    return { ok: false, error: ParseErrors.missingField("repo") };
  }

  if (!rawSpec.path) {
    return { ok: false, error: ParseErrors.missingField("path") };
  }

  if (!rawSpec.lang) {
    return { ok: false, error: ParseErrors.missingField("lang") };
  }

  const spec: GitRelaySpec = {
    repo: rawSpec.repo,
    path: rawSpec.path,
    lang: rawSpec.lang,
    lines: rawSpec.lines ?? { start: 1, end: null },
    host: detectGitHost(rawSpec.repo),
    branch: rawSpec.branch ?? null,
    commit: rawSpec.commit ?? null,
    mode: rawSpec.mode ?? "code",
    context: rawSpec.context ?? DEFAULT_RELAY_CONTEXT,
    note: rawSpec.note ?? null,
  };

  return { ok: true, spec };
}
