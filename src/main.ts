import { getFetchErrorMessage } from "./diagnostics";
import { fetchText } from "./http-client";
import { MarkdownRenderChild, MarkdownRenderer, Plugin } from "obsidian";

import { parseSpec } from "./parser";

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
            text: `Error: ${parseResult.error}`,
            cls: "git-relay-error-text",
          });
          return;
        }

        const fetchResult = await fetchText(
          parseResult.target.contentURL.toString(),
        );

        if (!fetchResult.ok) {
          console.error("fetch failed: ", {
            source,
            status: fetchResult.status,
            body: fetchResult.body,
          });
          container.createEl("p", {
            text: `Error: ${getFetchErrorMessage(fetchResult.status)}`,
            cls: "git-relay-error-text",
          });
          return;
        }

        const text = fetchResult.text;
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

        const header = container.createEl("div", { cls: "git-relay-header" });
        header.createEl("span", {
          text: `${parseResult.target.name}`,
        });

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
