import {
  MarkdownRenderChild,
  MarkdownRenderer,
  Notice,
  Plugin,
  setIcon,
} from "obsidian";

import { getFetchErrorMessage } from "./diagnostics";
import { fetchText, FetchTextResult } from "./http-client";
import { parseSpec } from "./parser";
import { GitRelayMetrics } from "./telemetry/metrics";

export default class GitRelayPlugin extends Plugin {
  private debugMode = false;
  private metrics: GitRelayMetrics | null = null;
  private cache = new Map<string, string>();
  private inflight = new Map<string, Promise<FetchTextResult>>();

  async onload() {
    this.registerGitRelayCommands();

    this.registerMarkdownCodeBlockProcessor(
      "git-relay",
      async (source, el, ctx) => {
        this.metrics?.incrProcessorRuns();

        const container = el.createDiv({
          cls: "git-relay-content",
        });

        const parseResult = parseSpec(source);
        if (!parseResult.ok) {
          this.renderGitRelayError(container, parseResult.error);
          return;
        }

        // Key is the full file URL; line slicing happens after cache retrieval.
        const cacheKey = parseResult.target.contentURL.toString();

        const getContentResult = await this.fetchContent(cacheKey);
        if (!getContentResult.ok) {
          this.metrics?.incrFetchFailure();
          console.error("[git-relay]", "fetch failed: ", {
            source,
            status: getContentResult.status,
            body: getContentResult.body,
          });

          this.renderGitRelayError(
            container,
            getFetchErrorMessage(getContentResult.status),
          );
          return;
        }

        const text = getContentResult.text;
        const { start: startLine, end: endLine } = parseResult.target.lines;

        const fileLines = text.split(/\r?\n/);
        let snippetLines = fileLines.slice(
          startLine - 1,
          endLine ?? fileLines.length,
        );

        const isPartialSnippet =
          startLine !== 1 || (endLine !== null && endLine !== fileLines.length);
        if (isPartialSnippet) {
          snippetLines = dedent(snippetLines);
        }

        this.createGitRelayHeader(
          container,
          parseResult.target.name,
          parseResult.target.permalink.toString(),
        );
        const codeContainer = container.createDiv({
          cls: "git-relay-code",
        });
        const child = new MarkdownRenderChild(codeContainer);
        ctx.addChild(child);

        const lang = parseResult.target.lang ?? "";
        const content = snippetLines.join("\n");

        const markdown = `\`\`\`${lang}\n${content}\n\`\`\``;
        await MarkdownRenderer.render(
          this.app,
          markdown,
          codeContainer,
          ctx.sourcePath,
          child,
        );
      },
    );
  }

  private async fetchContent(cacheKey: string): Promise<FetchTextResult> {
    if (this.cache.has(cacheKey)) {
      this.metrics?.incrCacheHit();
      const text = this.cache.get(cacheKey)!;

      return { ok: true, text };
    }

    this.metrics?.incrCacheMiss();

    if (this.inflight.has(cacheKey)) {
      this.metrics?.incrInflightHits();
      const inflightRequest = this.inflight.get(cacheKey)!;

      const fetchResult = await inflightRequest;
      return fetchResult;
    }

    this.metrics?.incrFetchRequest();
    const fetchPromise = fetchText(cacheKey);
    this.inflight.set(cacheKey, fetchPromise);

    try {
      const fetchResult = await fetchPromise;
      if (!fetchResult.ok) {
        return fetchResult;
      }

      this.cache.set(cacheKey, fetchResult.text);
      return fetchResult;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private registerGitRelayCommands() {
    this.addCommand({
      id: "git-relay-toggle-debug-mode",
      name: "Toggle debug mode",
      callback: () => {
        this.debugMode = !this.debugMode;

        if (this.debugMode) {
          this.metrics = new GitRelayMetrics();

          this.addCommand({
            id: "git-relay-print-metrics",
            name: "Print relay metrics",
            callback: () => {
              const snapshot = this.metrics?.snapshot();

              if (!snapshot) {
                return;
              }

              console.debug("[git-relay] counters", snapshot.counters);

              console.debug("[git-relay] ratios", {
                fetchFailureRate: `${(
                  snapshot.ratios.fetchFailureRate * 100
                ).toFixed(2)}%`,

                cacheHitRatio: `${(snapshot.ratios.cacheHitRatio * 100).toFixed(
                  2,
                )}%`,

                fetchesPerRender: snapshot.ratios.fetchesPerRender.toFixed(2),
              });
            },
          });

          console.debug("[git-relay] debug mode enabled");
          new Notice(
            `Git Relay: debug mode ${this.debugMode ? "enabled" : "disabled"}`,
            2000,
          );
        } else {
          this.metrics = null;

          this.removeCommand("git-relay-print-metrics");
          console.debug("[git-relay] debug mode disabled");

          new Notice(
            `Git Relay: debug mode ${this.debugMode ? "enabled" : "disabled"}`,
            2000,
          );
        }
      },
    });

    this.addCommand({
      id: "git-relay-clear-cache",
      name: "Clear relay cache",
      callback: () => {
        const size = this.cache.size;

        this.cache.clear();
        console.debug("[git-relay] cleared cache", { entries: size });
        new Notice(`Git Relay: cleared ${size} cached entries`, 2000);
      },
    });
  }

  private renderGitRelayError(container: HTMLElement, error: string) {
    container.createEl("p", {
      text: `Error: ${error}`,
      cls: "git-relay-error-text",
    });
  }

  private createGitRelayHeader(
    container: HTMLElement,
    title: string,
    permalink: string,
  ): HTMLElement {
    const headerEl = container.createEl("div", {
      cls: "git-relay-header",
    });

    const fileLinkEl = headerEl.createEl("a", {
      href: permalink,
      cls: "git-relay-header-title",
    });

    const fileIconEl = fileLinkEl.createEl("div", {
      cls: "git-relay-header-title-icon",
    });

    fileIconEl.setAttr("aria-hidden", "true");
    setIcon(fileIconEl, "file");

    fileLinkEl.createEl("span", {
      text: title,
      cls: "git-relay-header-title-text",
    });

    return headerEl;
  }
}

function dedent(lines: string[]): string[] {
  let minIndent = Infinity;

  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    minIndent = Math.min(minIndent, indent);
  }

  if (minIndent === Infinity || minIndent === 0) {
    return lines;
  }

  return lines.map((line) => line.slice(minIndent));
}
