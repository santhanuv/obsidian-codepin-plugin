import { describe, expect, it } from "vitest";

import {
  createFence,
  createSpec,
  decodeSpec,
  encodeSpec,
  hashContent,
  SPEC_VERSION,
  verifySnippetIntegrity,
  type CodepinSpec,
} from "./spec";

import type { CodepinTarget } from "./permalink";

function expectOk<T>(result: { ok: boolean; data?: T; error?: string }): T {
  expect(result.ok, `Failed with error: ${result.error}`).toBe(true);
  if (!result.ok) {
    throw new Error(result.error ?? "expected ok result");
  }

  return result.data!;
}

function createTarget(overrides: Partial<CodepinTarget> = {}): CodepinTarget {
  return {
    permalink: new URL("https://github.com/org/repo/blob/main/file.ts#L1-L3"),
    host: "github",
    contentURL: new URL(
      "https://raw.githubusercontent.com/org/repo/main/file.ts",
    ),
    name: "file.ts",
    lines: {
      start: 1,
      end: 3,
    },
    lang: "ts",
    ...overrides,
  };
}

describe("createFence", () => {
  it("uses a normal triple backtick fence when the snippet contains no fences", () => {
    const fence = createFence("const value = 1;");

    expect(fence).toBe("```");
  });

  it("creates a longer fence when the snippet already contains backticks", () => {
    const fence = createFence(["const code = `example`;", "```"].join("\n"));

    expect(fence).toBe("````");
  });
});

describe("createSpec", () => {
  it("creates a spec from a full file snippet", async () => {
    const target = createTarget();
    const result = await createSpec(
      target,
      ["const a = 1;", "const b = 2;", "const c = 3;"].join("\n"),
    );

    const spec = expectOk(result);

    expect(spec.sourceURL).toBe(target.permalink.toString());
    expect(spec.sourceContentURL).toBe(target.contentURL.toString());
    expect(spec.filename).toBe("file.ts");
    expect(spec.startLine).toBe(1);
    expect(spec.endLine).toBe(3);
    expect(spec.lang).toBe("ts");
    expect(spec.snippet).toBe(
      ["const a = 1;", "const b = 2;", "const c = 3;"].join("\n"),
    );
    expect(spec.snippetHash).toBeTruthy();
    expect(spec.sourceContentHash).toBeTruthy();
  });

  it("dedents partial snippets", async () => {
    const target = createTarget({
      lines: {
        start: 2,
        end: 4,
      },
    });

    const result = await createSpec(
      target,
      [
        "function main() {",
        "    if (true) {",
        "        return 1;",
        "    }",
        "}",
      ].join("\n"),
    );

    const spec = expectOk(result);
    expect(spec.snippet).toBe(["if (true) {", "    return 1;", "}"].join("\n"));
  });

  it("normalizes line endings before hashing", async () => {
    const target = createTarget();

    const lfResult = await createSpec(target, "a\nb\nc");
    const crlfResult = await createSpec(target, "a\r\nb\r\nc");

    const lfSpec = expectOk(lfResult);
    const crlfSpec = expectOk(crlfResult);

    expect(lfSpec.snippetHash).toBe(crlfSpec.snippetHash);
    expect(lfSpec.sourceContentHash).toBe(crlfSpec.sourceContentHash);
  });
});

describe("encodeSpec / decodeSpec", () => {
  it("roundtrips a spec through encoding and decoding", async () => {
    const snippet = ["const a = 1;", "const b = 2;\n"].join("\n");
    const snippetHash = await hashContent(snippet);

    const spec: CodepinSpec = {
      specVersion: SPEC_VERSION,
      sourceURL: "https://github.com/org/repo/blob/main/file.ts#L1-L2",
      sourceContentURL:
        "https://raw.githubusercontent.com/org/repo/main/file.ts",
      filename: "file.ts",
      startLine: 1,
      endLine: 2,
      lang: "ts",
      snippet,
      snippetHash: snippetHash,
      sourceContentHash: snippetHash,
    };

    const encoded = encodeSpec(spec);
    expect(encoded.startsWith("```codepin")).toBe(true);

    const inner = encoded.split("\n").slice(1, -1).join("\n");
    const decoded = decodeSpec(inner);

    expect(decoded).toEqual({
      ok: true,
      data: spec,
    });
  });

  it("supports snippets containing markdown fences", () => {
    const spec: CodepinSpec = {
      specVersion: SPEC_VERSION,
      sourceURL: "https://github.com/org/repo/blob/main/file.ts#L1-L3",
      sourceContentURL:
        "https://raw.githubusercontent.com/org/repo/main/file.ts",
      filename: "file.ts",
      startLine: 1,
      endLine: 3,
      lang: "ts",
      snippet: ["function main() {", "```", "}"].join("\n"),
      snippetHash: "snippet-hash",
      sourceContentHash: "source-hash",
    };

    const encoded = encodeSpec(spec);
    expect(encoded.startsWith("````codepin")).toBe(true);
  });

  it("rejects specs without a metadata separator", () => {
    const result = decodeSpec(
      ["sourceURL: https://example.com", "filename: file.ts"].join("\n"),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects specs with missing required metadata", () => {
    const result = decodeSpec(
      ["filename: file.ts", "---", "const a = 1;"].join("\n"),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects snippetHash that is not valid SHA-256", () => {
    const source = [
      `specVersion: ${SPEC_VERSION}`,
      "sourceURL: https://github.com/org/repo/blob/main/file.ts#L1-L2",
      "sourceContentURL: https://raw.githubusercontent.com/org/repo/main/file.ts",
      "filename: file.ts",
      "startLine: 1",
      "endLine: 2",
      "lang: ts",
      "snippetHash: invalidhash",
      "sourceContentHash: invalidhash",
      "---",
      "const a = 1;",
    ].join("\n");

    const result = decodeSpec(source);
    expect(result.ok).toBe(false);
  });

  it("rejects when snippet content does not match snippetHash", async () => {
    const snippet = "const a = 1;";
    const snippetHash = await hashContent("different snippet");

    const source = [
      `specVersion: ${SPEC_VERSION}`,
      "sourceURL: https://github.com/org/repo/blob/main/file.ts#L1-L1",
      "sourceContentURL: https://raw.githubusercontent.com/org/repo/main/file.ts",
      "filename: file.ts",
      "startLine: 1",
      "endLine: 1",
      "lang: ts",
      `snippetHash: ${snippetHash}`,
      `sourceContentHash: ${snippetHash}`,
      "---",
      snippet,
    ].join("\n");

    const spec = expectOk(decodeSpec(source));
    const result = await verifySnippetIntegrity(spec);

    expect(result.ok).toBe(false);
  });
});
