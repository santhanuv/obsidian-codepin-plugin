import { describe, expect, it } from "vitest";
import { DEFAULT_RELAY_CONTEXT, detectGitHost, parseSpec } from "./parser";
import { ParseErrors } from "./diagnostics";

describe("detectGitHost", () => {
  it("detects github repositories", () => {
    expect(detectGitHost("https://github.com/example/repo")).toBe("github");
  });

  it("detects gitlab repositories", () => {
    expect(detectGitHost("https://gitlab.com/example/repo")).toBe("gitlab");
  });

  it("returns unknown for unsupported hosts", () => {
    expect(detectGitHost("https://example.com/repo")).toBe("unknown");
  });
});

describe("parseSpec", () => {
  const minimalSpec = `
    repo: https://github.com/example/repo
    path: src/main.c
    lang: c
  `;

  it("parses a minimal valid spec", () => {
    const result = parseSpec(minimalSpec);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.spec.repo).toBe("https://github.com/example/repo");

    expect(result.spec.path).toBe("src/main.c");

    expect(result.spec.lang).toBe("c");

    expect(result.spec.host).toBe("github");
  });

  it("applies default values", () => {
    const result = parseSpec(minimalSpec);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.spec.branch).toBeNull();

    expect(result.spec.commit).toBeNull();

    expect(result.spec.mode).toBe("code");

    expect(result.spec.context).toBe(DEFAULT_RELAY_CONTEXT);

    expect(result.spec.lines).toEqual({
      start: 1,
      end: null,
    });

    expect(result.spec.note).toBeNull();
  });

  it.each([
    ["10-20", { start: 10, end: 20 }],
    ["10-", { start: 10, end: null }],
    ["-20", { start: 1, end: 20 }],
    ["-", { start: 1, end: null }],
  ])("parses valid line range '%s'", (lines, expected) => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
      lang: c
      lines: ${lines}
    `);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.spec.lines).toEqual(expected);
  });

  it("rejects invalid line ranges", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
      lang: c
      lines: 20-10
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.invalidLineRange(),
    });
  });

  it("rejects invalid modes", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
      lang: c
      mode: invalid
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.invalidMode(),
    });
  });

  it("rejects non-numeric context", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
      lang: c
      context: abc
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.invalidContext(),
    });
  });

  it("rejects negative context", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
      lang: c
      context: -1
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.invalidContext(),
    });
  });

  it("rejects missing repo", () => {
    const result = parseSpec(`
      path: src/main.c
      lang: c
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.missingField("repo"),
    });
  });

  it("rejects missing path", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      lang: c
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.missingField("path"),
    });
  });

  it("rejects missing lang", () => {
    const result = parseSpec(`
      repo: https://github.com/example/repo
      path: src/main.c
    `);

    expect(result).toEqual({
      ok: false,
      error: ParseErrors.missingField("lang"),
    });
  });

  it("parses optional fields", () => {
    const result = parseSpec(`
      repo: https://gitlab.com/example/repo
      path: src/main.c
      lang: c
      branch: main
      commit: abc123
      mode: diff
      context: 8
      note: allocator investigation
    `);

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.spec.branch).toBe("main");

    expect(result.spec.commit).toBe("abc123");

    expect(result.spec.mode).toBe("diff");

    expect(result.spec.context).toBe(8);

    expect(result.spec.note).toBe("allocator investigation");
  });
});
