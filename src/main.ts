import {
  Notice,
  Plugin,
  setIcon,
  MarkdownRenderChild,
  MarkdownRenderer,
} from "obsidian";

import { getFetchErrorMessage, HashErrors } from "./diagnostics";
import { fetchText, FetchTextResult } from "./http-client";
import { CodepinMetrics } from "./telemetry/metrics";
import { parsePermalink } from "./parser/permalink";
import {
  createSpec,
  decodeSpec,
  encodeSpec,
  verifySnippetIntegrity,
  renderSnippet,
} from "./parser/spec";
import { CodepinModal } from "./modal";

export default class CodepinPlugin extends Plugin {
  private debugMode = false;
  private metrics: CodepinMetrics | null = null;
  private cache = new Map<string, string>();
  private inflight = new Map<string, Promise<FetchTextResult>>();

  async onload() {
    this.registerCodepinCommands();

    this.registerMarkdownCodeBlockProcessor(
      "codepin",
      async (source, el, ctx) => {
        this.metrics?.incrProcessorRuns();

        const container = el.createDiv({
          cls: "codepin-content",
        });

        const decodeResult = decodeSpec(source);
        if (!decodeResult.ok) {
          this.renderCodepinError(container, decodeResult.error);
          return;
        }

        this.createCodepinHeader(
          container,
          decodeResult.data.filename,
          decodeResult.data.sourceURL.toString(),
        );

        const codeContainer = container.createDiv({
          cls: "codepin-code",
        });
        const child = new MarkdownRenderChild(codeContainer);
        ctx.addChild(child);

        const markdown = renderSnippet(decodeResult.data);
        await MarkdownRenderer.render(
          this.app,
          markdown,
          codeContainer,
          ctx.sourcePath,
          child,
        );

        const snippetIntegrity = await verifySnippetIntegrity(
          decodeResult.data,
        );
        if (!snippetIntegrity.ok) {
          this.createCodepinFooter(
            container,
            HashErrors.snippetIntegrityFailed(),
          );
        }
      },
    );
  }

  onunload() {
    if (this.debugMode) {
      this.removeCommand("codepin-print-metrics");
    }

    return;
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

  private registerCodepinCommands() {
    this.addCommand({
      id: "codepin-toggle-debug-mode",
      name: "Toggle debug mode",
      callback: () => this.toggleDebugMode(),
    });

    this.addCommand({
      id: "codepin-clear-cache",
      name: "Clear cache",
      callback: () => {
        const size = this.cache.size;

        this.cache.clear();
        console.debug("[codepin] cleared cache", { entries: size });
        new Notice(`Codepin: cleared ${size} cached entries`, 2000);
      },
    });

    this.addCommand({
      id: "codepin-insert-spec",
      name: "Insert spec",
      editorCallback: (editor) => {
        new CodepinModal(this.app, async (url) => {
          const parseResult = parsePermalink(url);
          if (!parseResult.ok) {
            new Notice(parseResult.error, 0);
            return;
          }

          const cacheKey = parseResult.data.contentURL.toString();

          const getContentResult = await this.fetchContent(cacheKey);
          if (!getContentResult.ok) {
            console.error("[codepin]", "fetch failed: ", {
              permalink: parseResult.data.permalink,
              status: getContentResult.status,
              body: getContentResult.body,
            });

            new Notice(getFetchErrorMessage(getContentResult.status), 0);
            return;
          }

          const createSpecResult = await createSpec(
            parseResult.data,
            getContentResult.text,
          );
          if (!createSpecResult.ok) {
            console.error(
              "[codepin]",
              "create spec failed: ",
              createSpecResult.error,
            );
            new Notice(`Insert spec failed. ${createSpecResult.error}`, 0);
            return;
          }

          const encodedSpec = encodeSpec(createSpecResult.data);
          editor.replaceRange(encodedSpec, editor.getCursor());
        }).open();
      },
    });
  }

  private printCodepinMetrics() {
    const snapshot = this.metrics?.snapshot();

    if (!snapshot) {
      return;
    }

    console.debug("[codepin] counters", snapshot.counters);

    console.debug("[codepin] ratios", {
      cacheHitRatio: `${(snapshot.ratios.cacheHitRatio * 100).toFixed(2)}%`,
    });
  }

  private toggleDebugMode() {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      this.metrics = new CodepinMetrics();

      this.addCommand({
        id: "codepin-print-metrics",
        name: "Print metrics",
        callback: () => this.printCodepinMetrics(),
      });

      console.debug("[codepin] debug mode enabled");
    } else {
      this.metrics = null;

      this.removeCommand("codepin-print-metrics");
      console.debug("[codepin] debug mode disabled");
    }

    new Notice(
      `Codepin: debug mode ${this.debugMode ? "enabled" : "disabled"}`,
      2000,
    );
  }

  private renderCodepinError(container: HTMLElement, error: string) {
    container.createEl("p", {
      text: `Error: ${error}`,
      cls: "codepin-error-text",
    });
  }

  private createCodepinHeader(
    container: HTMLElement,
    title: string,
    permalink: string,
  ): HTMLElement {
    const headerEl = container.createEl("div", {
      cls: "codepin-header",
    });

    const fileLinkEl = headerEl.createEl("a", {
      href: permalink,
      cls: "codepin-header-title",
    });

    const fileIconEl = fileLinkEl.createEl("div", {
      cls: "codepin-header-title-icon",
    });

    fileIconEl.setAttr("aria-hidden", "true");
    setIcon(fileIconEl, "file");

    fileLinkEl.createEl("span", {
      text: title,
      cls: "codepin-header-title-text",
    });

    return headerEl;
  }

  private createCodepinFooter(container: HTMLElement, message: string) {
    const footerEL = container.createEl("div", {
      cls: "codepin-footer",
    });

    const warningIconEl = footerEL.createEl("div", {
      cls: "codepin-footer-icon",
    });

    warningIconEl.setAttr("aria-hidden", "true");
    setIcon(warningIconEl, "triangle-alert");

    footerEL.createEl("span", {
      text: message,
      cls: "codepin-footer-status-text",
    });
  }
}
