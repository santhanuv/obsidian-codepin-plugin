import { MarkdownRenderChild, MarkdownRenderer, Plugin } from "obsidian";
import { parseSpec } from "parser";

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
            text: `Error: ${parseResult.error}`,
            cls: "git-relay-error-text",
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
