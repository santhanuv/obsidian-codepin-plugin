import { MarkdownRenderChild, MarkdownRenderer, Plugin } from "obsidian";
import { parseSpec } from "./parser";
import { getGitFile } from "./provider";

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

        const fetched = await getGitFile({
          repoUrl: spec.repo,
          path: spec.path,
          ref: spec.ref,
        });

        if (!fetched.ok) {
          container.createEl("p", {
            text: `Error: ${fetched.error}`,
            cls: "git-relay-error-text",
          });
          return;
        }

        const lines = fetched.content.slice(
          spec.lines.start - 1,
          spec.lines.end ?? fetched.content.length,
        );

        const header = container.createEl("div", { cls: "git-relay-header" });
        header.createEl("span", { text: `${spec.repo}/${spec.path}` });

        const codeContainer = container.createDiv({
          cls: "git-relay-code",
        });

        const child = new MarkdownRenderChild(codeContainer);
        ctx.addChild(child);

        const markdown = `\`\`\`${spec.lang}\n${lines.join("\n")}\n\`\`\``;
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
