import { describe, expect, it } from "vitest";

import { parseSpec } from "./parser";

describe("parseSpec", () => {
  it("parses a github permalink", () => {
    const result = parseSpec(
      `https://github.com/test-owner/test/blob/main/file.ts#L10-L20`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.host).toBe("github");
    expect(result.target.contentURL.toString()).toBe(
      "https://raw.githubusercontent.com/test-owner/test/main/file.ts",
    );

    expect(result.target.lines).toEqual({
      start: 10,
      end: 20,
    });

    expect(result.target.lang).toBe("ts");
    expect(result.target.name).toBe("file.ts");
  });

  it("parses a gitlab permalink", () => {
    const result = parseSpec(
      `https://gitlab.com/group/project/-/blob/main/src/app.go#L10-20`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.host).toBe("gitlab");
    expect(result.target.contentURL.toString()).toBe(
      "https://gitlab.com/group/project/-/raw/main/src/app.go",
    );

    expect(result.target.lines).toEqual({
      start: 10,
      end: 20,
    });

    expect(result.target.lang).toBe("go");
  });

  it("supports generic raw urls", () => {
    const result = parseSpec(`https://example.com/file.rs`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.host).toBe("generic");
    expect(result.target.contentURL.toString()).toBe(
      "https://example.com/file.rs",
    );

    expect(result.target.lang).toBe("rs");
  });

  it("supports explicit language override", () => {
    const result = parseSpec(`
      https://example.com/file.txt
      lang: ts
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.lang).toBe("ts");
  });

  it("defaults line range to full file", () => {
    const result = parseSpec(`
      https://example.com/file.ts
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.lines).toEqual({
      start: 1,
      end: null,
    });
  });

  it("supports github single line anchors", () => {
    const result = parseSpec(`
      https://github.com/org/repo/blob/main/file.ts#L15
    `);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.lines).toEqual({
      start: 15,
      end: null,
    });
  });

  it("rejects invalid permalink urls", () => {
    const result = parseSpec(`not-a-url`);
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported protocols", () => {
    const result = parseSpec(`ftp://example.com/file.ts`);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid github permalinks", () => {
    const result = parseSpec(`https://github.com/org/repo/tree/main/file.ts`);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid gitlab permalinks", () => {
    const result = parseSpec(
      `https://gitlab.com/group/project/-/tree/main/file.ts`,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid line ranges", () => {
    const result = parseSpec(
      `https://github.com/org/repo/blob/main/file.ts#L20-L10`,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects malformed line anchors", () => {
    const result = parseSpec(
      `https://github.com/org/repo/blob/main/file.ts#foo`,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid metadata lines", () => {
    const result = parseSpec(`
      https://example.com/file.ts
      foo: bar
    `);
    expect(result.ok).toBe(false);
  });

  it("rejects more than 2 lines", () => {
    const result = parseSpec(`
      https://example.com/file.ts
      lang: ts
      extra: value
    `);
    expect(result.ok).toBe(false);
  });

  it("detects special filenames", () => {
    const result = parseSpec(`https://example.com/Dockerfile`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.lang).toBe("dockerfile");
  });

  it("preserves hashes only as renderer metadata", () => {
    const result = parseSpec(
      `https://github.com/org/repo/blob/main/file.ts#L1-L5`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.target.permalink.hash).toBe("#L1-L5");
    expect(result.target.contentURL.hash).toBe("");
  });
});
