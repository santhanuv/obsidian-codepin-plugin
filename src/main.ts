import { MarkdownRenderChild, MarkdownRenderer, Plugin } from "obsidian";

const DEFAULT_RELAY_CONTEXT = 3;

type RelayLineRange = { start: number; end: number | null };

type GitHost = "gitlab" | "github" | "unknown";
type RelayMode = "code" | "diff";

interface GitRelaySpec {
  repo: string;
  path: string;
  lang: string;
  host: GitHost;
  branch: string | null;
  commit: string | null; // commit has more preference over branch
  lines: RelayLineRange;
  mode: RelayMode;
  context: number; // context is valid only in diff mode
  note: string | null;
}

type ParseSpecResult =
  | { ok: true; spec: GitRelaySpec }
  | { ok: false; error: string };

function detectGitHost(repo: string): GitHost {
  if (repo.includes("gitlab.com")) {
    return "gitlab";
  } else if (repo.includes("github.com")) {
    return "github";
  }

  return "unknown";
}

function parseSpec(source: string): ParseSpecResult {
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
            error: "git-relay: `mode` should only be 'code' or 'diff'",
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
            error: "git-relay: `context` should be a number",
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
            error: "git-relay: `lines` should be of the form 'start-end'",
          };
        }

        const [, startStr, endStr] = match;

        const start = startStr ? parseInt(startStr) : 1;
        const end = endStr ? parseInt(endStr) : null;

        if (end !== null && start > end) {
          return {
            ok: false,
            error:
              "git-relay: invalid values for `lines`; start should be less than end",
          };
        }

        rawSpec.lines = { start, end };
        break;
      }
    }
  }

  if (!rawSpec.repo) {
    return { ok: false, error: "git-relay: `repo` is required" };
  }

  if (!rawSpec.path) {
    return { ok: false, error: "git-relay: `path` is required" };
  }

  if (!rawSpec.lang) {
    return { ok: false, error: "git-relay: `lang` is required" };
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

// Hardcoded until real fetch lands
const MOCK_LINES = [
  "#include <stdio.h>",
  "",
  "int main() {",
  '    printf("hello, world\\n");',
  "    return 1;",
  "}",
];

export default class GitRelayPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor(
      "git-relay",
      async (source, el, ctx) => {
        const container = el.createDiv({
          cls: "git-relay-content",
        });

        const parseResult = parseSpec(source);

        if (!parseResult.ok) {
          container.createEl("p", {
            text: `git-relay error: ${parseResult.error}`,
          });
          return;
        }
        const spec = parseResult.spec;

        const lines = MOCK_LINES.slice(
          spec.lines.start - 1,
          spec.lines.end ?? MOCK_LINES.length,
        );

        const header = container.createEl("div", { cls: "git-relay-header" });
        header.createEl("span", { text: `${spec.repo}/${spec.path}` });

        const codeContainer = container.createDiv({
          cls: "git-relay-code",
        });

        const child = new MarkdownRenderChild(codeContainer);
        ctx.addChild(child);

        const markdown = "```" + spec.lang + "\n" + lines.join("\n") + "\n```";
        await MarkdownRenderer.render(
          this.app,
          markdown,
          codeContainer,
          ctx.sourcePath,
          child,
        );

        if (spec.note) {
          container.createEl("div", {
            text: `${spec.note}`,
            cls: "git-relay-footer",
          });
        }
      },
    );
  }
}
