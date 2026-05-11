import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RELAY_CONTEXT, detectGitHost, parseSpec } from "./parser";
import { ParseErrors } from "./diagnostics";

const expectOk = vi.defineHelper((source: string) => {
  const result = parseSpec(source);

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error("Expected successful parse");
  }

  return result.spec;
});

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
    const spec = expectOk(minimalSpec);

    expect(spec.repo).toBe("https://github.com/example/repo");

    expect(spec.path).toBe("src/main.c");

    expect(spec.lang).toBe("c");

    expect(spec.host).toBe("github");
  });

  describe("defaults", () => {
    it("applies default values", () => {
      const spec = expectOk(minimalSpec);

      expect(spec.ref).toBeNull();

      expect(spec.mode).toBe("code");

      expect(spec.context).toBe(DEFAULT_RELAY_CONTEXT);

      expect(spec.lines).toEqual({
        start: 1,
        end: null,
      });

      expect(spec.note).toBeNull();
    });
  });

  describe("required fields", () => {
    it("rejects missing repo", () => {
      expect(
        parseSpec(`
        path: src/main.c
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingField("repo"),
      });
    });

    it("rejects missing path", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingField("path"),
      });
    });

    it("rejects missing lang", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingField("lang"),
      });
    });

    it("rejects empty repo", () => {
      expect(
        parseSpec(`
        repo:
        path: src/main.c
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingValue("repo"),
      });
    });

    it("rejects empty path", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path:
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingValue("path"),
      });
    });

    it("rejects empty lang", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang:
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingValue("lang"),
      });
    });
  });

  describe("line parsing", () => {
    it.each([
      ["10-20", { start: 10, end: 20 }],
      ["10-", { start: 10, end: null }],
      ["-20", { start: 1, end: 20 }],
      ["-", { start: 1, end: null }],
    ])("parses valid line range '%s'", (lines, expected) => {
      const spec = expectOk(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        lines: ${lines}
      `);

      expect(spec.lines).toEqual(expected);
    });

    it("rejects invalid line ranges", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        lines: 20-10
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.invalidLineRange(),
      });
    });
  });

  describe("mode parsing", () => {
    it("rejects invalid modes", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        mode: invalid
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.invalidMode(),
      });
    });
  });

  describe("context parsing", () => {
    it("rejects non-numeric context", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        context: abc
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.invalidContext(),
      });
    });

    it("rejects negative context", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        context: -1
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.invalidContext(),
      });
    });
  });

  describe("ref parsing", () => {
    it("parses branch refs", () => {
      const spec = expectOk(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        branch: main
      `);

      expect(spec.ref).toEqual({
        type: "branch",
        value: "main",
      });
    });

    it("parses commit refs", () => {
      const spec = expectOk(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        commit: abc123
      `);

      expect(spec.ref).toEqual({
        type: "commit",
        value: "abc123",
      });
    });

    it("rejects branch and commit refs together", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        branch: main
        commit: abc123
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.conflictingRef(),
      });
    });

    it("rejects empty branch refs", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        branch:
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingValue("branch"),
      });
    });

    it("rejects empty commit refs", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        commit:
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.missingValue("commit"),
      });
    });

    it("rejects duplicate branch fields", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        branch: main
        branch: dev
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.duplicateField("branch"),
      });
    });

    it("rejects duplicate commit fields", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        commit: abc
        commit: def
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.duplicateField("commit"),
      });
    });
  });

  describe("syntax validation", () => {
    it("rejects malformed field syntax", () => {
      expect(
        parseSpec(`
        repo https://github.com/example/repo
        path: src/main.c
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.invalidFieldFormat(
          "repo https://github.com/example/repo",
        ),
      });
    });

    it("rejects unknown fields", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        path: src/main.c
        lang: c
        brnch: main
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.unknownField("brnch"),
      });
    });
  });

  describe("duplicate fields", () => {
    it("rejects duplicate normal fields", () => {
      expect(
        parseSpec(`
        repo: https://github.com/example/repo
        repo: https://github.com/example/other
        path: src/main.c
        lang: c
      `),
      ).toMatchObject({
        ok: false,
        error: ParseErrors.duplicateField("repo"),
      });
    });
  });

  describe("optional fields", () => {
    it("parses optional fields", () => {
      const spec = expectOk(`
        repo: https://gitlab.com/example/repo
        path: src/main.c
        lang: c
        commit: abc123
        mode: diff
        context: 8
        note: test note
      `);

      expect(spec.ref).toEqual({
        type: "commit",
        value: "abc123",
      });

      expect(spec.mode).toBe("diff");

      expect(spec.context).toBe(8);

      expect(spec.note).toBe("test note");
    });
  });
});
