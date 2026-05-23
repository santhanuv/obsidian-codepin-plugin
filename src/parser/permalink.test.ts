import { describe, expect, it } from "vitest";

import { parsePermalink } from "./permalink";

function expectOk<T>(result: { ok: boolean; data?: T; error?: string }): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error ?? "expected ok result");
  }

  return result.data!;
}

describe("parsePermalink", () => {
  it("parses a GitHub permalink into a raw content URL and line range", () => {
    const result = parsePermalink(
      "https://github.com/test-owner/test/blob/main/file.ts#L10-L20",
    );

    const target = expectOk(result);

    expect(target.host).toBe("github");
    expect(target.contentURL.toString()).toBe(
      "https://raw.githubusercontent.com/test-owner/test/main/file.ts",
    );
    expect(target.lines).toEqual({ start: 10, end: 20 });
    expect(target.lang).toBe("ts");
    expect(target.name).toBe("file.ts");
    expect(target.permalink.toString()).toBe(
      "https://github.com/test-owner/test/blob/main/file.ts#L10-L20",
    );
  });

  it("parses a GitLab permalink into a raw content URL", () => {
    const result = parsePermalink(
      "https://gitlab.com/group/project/-/blob/main/src/app.go#L10-20",
    );

    const target = expectOk(result);

    expect(target.host).toBe("gitlab");
    expect(target.contentURL.toString()).toBe(
      "https://gitlab.com/group/project/-/raw/main/src/app.go",
    );
    expect(target.lines).toEqual({ start: 10, end: 20 });
    expect(target.lang).toBe("go");
    expect(target.name).toBe("app.go");
  });

  it("supports generic raw URLs", () => {
    const result = parsePermalink("https://example.com/file.rs");

    const target = expectOk(result);

    expect(target.host).toBe("generic");
    expect(target.contentURL.toString()).toBe("https://example.com/file.rs");
    expect(target.lines).toEqual({ start: 1, end: null });
    expect(target.lang).toBe("rs");
    expect(target.name).toBe("file.rs");
  });

  it("defaults the line range to the full file when no fragment is present", () => {
    const result = parsePermalink("https://example.com/file.ts");

    const target = expectOk(result);

    expect(target.lines).toEqual({ start: 1, end: null });
  });

  it("strips fragments from the content URL", () => {
    const result = parsePermalink(
      "https://github.com/org/repo/blob/main/file.ts#L1-L5",
    );

    const target = expectOk(result);

    expect(target.permalink.hash).toBe("#L1-L5");
    expect(target.contentURL.hash).toBe("");
  });

  it("detects special filenames", () => {
    const result = parsePermalink("https://example.com/Dockerfile");

    const target = expectOk(result);

    expect(target.name).toBe("Dockerfile");
    expect(target.lang).toBe("dockerfile");
  });

  it("rejects invalid URLs", () => {
    const result = parsePermalink("not-a-url");

    expect(result.ok).toBe(false);
  });

  it("rejects unsupported protocols", () => {
    const result = parsePermalink("ftp://example.com/file.ts");

    expect(result.ok).toBe(false);
  });

  it("rejects invalid GitHub permalinks", () => {
    const result = parsePermalink(
      "https://github.com/org/repo/tree/main/file.ts",
    );

    expect(result.ok).toBe(false);
  });

  it("rejects invalid GitLab permalinks", () => {
    const result = parsePermalink(
      "https://gitlab.com/group/project/-/tree/main/file.ts",
    );

    expect(result.ok).toBe(false);
  });

  it("rejects invalid line ranges", () => {
    const result = parsePermalink(
      "https://github.com/org/repo/blob/main/file.ts#L20-L10",
    );

    expect(result.ok).toBe(false);
  });

  it("rejects malformed line anchors", () => {
    const result = parsePermalink(
      "https://github.com/org/repo/blob/main/file.ts#foo",
    );

    expect(result.ok).toBe(false);
  });
});
