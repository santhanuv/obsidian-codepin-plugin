import { ParseErrors } from "./diagnostics";

const VALID_KEYS = new Set([
  "repo",
  "path",
  "lang",
  "lines",
  "mode",
  "branch",
  "commit",
  "context",
  "note",
]);

export const DEFAULT_RELAY_CONTEXT = 3;

export type RelayLineRange = { start: number; end: number | null };

export type GitHost = "gitlab" | "github" | "unknown";
export type RelayMode = "code" | "diff";
export type GitRef =
  | { type: "branch"; value: string }
  | { type: "commit"; value: string };

export interface GitRelaySpec {
  repo: string;
  path: string;
  lang: string;
  host: GitHost;
  ref: GitRef | null;
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
  const draftSpec: Partial<GitRelaySpec> = {};

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([a-z]+)\s*:\s*(.*)$/i);

    if (!match) {
      return {
        ok: false,
        error: ParseErrors.invalidFieldFormat(trimmed),
      };
    }

    const [, rawKey = "", rawVal = ""] = match;

    const key = rawKey.trim().toLowerCase();
    const val = rawVal.trim();

    if (!VALID_KEYS.has(key)) {
      return {
        ok: false,
        error: ParseErrors.unknownField(key),
      };
    }

    if (Object.hasOwn(draftSpec, key)) {
      return {
        ok: false,
        error: ParseErrors.duplicateField(key),
      };
    }

    if (!val) {
      return {
        ok: false,
        error: ParseErrors.missingValue(key),
      };
    }

    switch (key) {
      case "repo":
        draftSpec.repo = val;
        break;

      case "lang":
        draftSpec.lang = val;
        break;

      case "path":
        draftSpec.path = val;
        break;

      case "branch":
      case "commit": {
        if (draftSpec.ref) {
          return {
            ok: false,
            error:
              draftSpec.ref.type === key
                ? ParseErrors.duplicateField(key)
                : ParseErrors.conflictingRef(),
          };
        }

        draftSpec.ref = {
          type: key,
          value: val,
        };

        break;
      }

      case "mode": {
        if (val !== "code" && val !== "diff") {
          return {
            ok: false,
            error: ParseErrors.invalidMode(),
          };
        }

        draftSpec.mode = val;
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

        draftSpec.context = context;
        break;
      }
      case "note":
        draftSpec.note = val;
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

        draftSpec.lines = { start, end };
        break;
      }
    }
  }

  if (!draftSpec.repo) {
    return { ok: false, error: ParseErrors.missingField("repo") };
  }

  if (!draftSpec.path) {
    return { ok: false, error: ParseErrors.missingField("path") };
  }

  if (!draftSpec.lang) {
    return { ok: false, error: ParseErrors.missingField("lang") };
  }

  const spec: GitRelaySpec = {
    repo: draftSpec.repo,
    path: draftSpec.path,
    lang: draftSpec.lang,
    lines: draftSpec.lines ?? { start: 1, end: null },
    host: detectGitHost(draftSpec.repo),
    ref: draftSpec.ref ?? null,
    mode: draftSpec.mode ?? "code",
    context: draftSpec.context ?? DEFAULT_RELAY_CONTEXT,
    note: draftSpec.note ?? null,
  };

  return { ok: true, spec };
}
