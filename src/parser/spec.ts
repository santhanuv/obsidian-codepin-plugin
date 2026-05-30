import YAML from "yaml";
import { Result } from "../result";
import { CodepinTarget } from "./permalink";
import { HashErrors, ParseErrors } from "../diagnostics";

export const SPEC_VERSION = "1.0.0";
const HASH_ALGORITHM = "SHA-256";
const SHA256_HEX = /^[a-f0-9]{64}$/;

export interface CodepinSpec {
  specVersion: string;
  sourceURL: string;
  sourceContentURL: string;
  filename: string;
  startLine: number;
  endLine: number;
  lang: string;
  snippet: string;
  snippetHash: string;
  sourceContentHash: string;
}

export function createFence(content: string): string {
  const matches: string[] = content.match(/`{3,}/g) ?? [];

  const minReqBackticks = 3;
  const longestFence = matches.reduce<number>(
    (max, current) => Math.max(max, current.length),
    minReqBackticks - 1,
  );

  return "`".repeat(longestFence + 1);
}

export async function createSpec(
  target: CodepinTarget,
  content: string,
): Promise<Result<CodepinSpec>> {
  const { start: startLine, end: endLine } = target.lines;

  const fileLines = content.split(/\r?\n/);
  const maxEndLine = fileLines.at(-1) ? fileLines.length : fileLines.length - 1;
  const resolvedEndLine = endLine ?? maxEndLine;
  if (resolvedEndLine > maxEndLine) {
    return {
      ok: false,
      error: ParseErrors.specSnippetLineMismatch(resolvedEndLine, maxEndLine),
    };
  }

  let snippetLines = fileLines.slice(startLine - 1, resolvedEndLine);

  const isPartialSnippet = startLine !== 1 || resolvedEndLine !== maxEndLine;
  if (isPartialSnippet) {
    snippetLines = dedent(snippetLines);
  }

  const lang = target.lang ?? "";
  const snippet = snippetLines.join("\n");

  if (snippet.trim().length === 0) {
    return {
      ok: false,
      error: ParseErrors.specEmptySnippet(),
    };
  }

  let snippetHash: string;
  try {
    snippetHash = await hashContent(snippet);
  } catch (error) {
    console.error("[codepin]", "Failed to hash snippet", error);
    return { ok: false, error: HashErrors.snippetHashingFailed() };
  }

  let sourceContentHash: string;
  try {
    sourceContentHash = await hashContent(content);
  } catch (error) {
    console.error("[codepin]", "Failed to hash source content", error);
    return { ok: false, error: HashErrors.sourceContentHashingFailed() };
  }

  const spec: CodepinSpec = {
    specVersion: SPEC_VERSION,
    sourceURL: target.permalink.toString(),
    sourceContentURL: target.contentURL.toString(),
    filename: target.name,
    startLine: startLine,
    endLine: resolvedEndLine,
    lang: lang,
    snippet: snippet,
    snippetHash: snippetHash,
    sourceContentHash: sourceContentHash,
  };

  return { ok: true, data: spec };
}

export function encodeSpec(spec: CodepinSpec): string {
  const metadata = {
    specVersion: spec.specVersion,
    sourceURL: spec.sourceURL,
    sourceContentURL: spec.sourceContentURL,
    filename: spec.filename,
    startLine: spec.startLine,
    endLine: spec.endLine,
    lang: spec.lang,
    snippetHash: spec.snippetHash,
    sourceContentHash: spec.sourceContentHash,
  };

  const yaml = YAML.stringify(metadata).trimEnd();
  const fence = createFence(spec.snippet);

  return [`${fence}codepin`, yaml, "---", spec.snippet, fence].join("\n");
}

export function renderSnippet(spec: CodepinSpec): string {
  const fence = createFence(spec.snippet);
  return `${fence}${spec.lang}\n${spec.snippet}\n${fence}`;
}

export function decodeSpec(source: string): Result<CodepinSpec> {
  // MarkdownCodeBlockProcessor strips the fence before passing source for decoding.
  const lines = source.split("\n");

  const separatorIndex = lines.findIndex((line) => line.trim() === "---");
  if (separatorIndex === -1) {
    return {
      ok: false,
      error: ParseErrors.specMissingMetadataSep(),
    };
  }

  const metadataText = lines.slice(0, separatorIndex).join("\n");
  const snippet = lines.slice(separatorIndex + 1).join("\n");
  let metadata;
  try {
    metadata = YAML.parse(metadataText) as unknown;
  } catch (e) {
    console.error(e);
    const message = (e as { message: string }).message;
    return {
      ok: false,
      error: `${ParseErrors.invalidSpec()}\n${message ?? "Check console for details."}`,
    };
  }

  if (typeof metadata !== "object" || metadata === null) {
    return {
      ok: false,
      error: ParseErrors.invalidMetadata(),
    };
  }
  const parsed = metadata as Partial<CodepinSpec>;

  if (typeof parsed.specVersion !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("specVersion"),
    };
  }

  if (typeof parsed.sourceURL !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("sourceURL"),
    };
  }

  if (typeof parsed.sourceContentURL !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("sourceContentURL"),
    };
  }

  if (typeof parsed.filename !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("filename"),
    };
  }

  if (
    typeof parsed.startLine !== "number" ||
    !Number.isInteger(parsed.startLine)
  ) {
    return {
      ok: false,
      error: ParseErrors.specMissingField("startLine"),
    };
  }

  if (typeof parsed.endLine !== "number" || !Number.isInteger(parsed.endLine)) {
    return {
      ok: false,
      error: ParseErrors.specMissingField("endLine"),
    };
  }

  if (typeof parsed.snippetHash !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("snippetHash"),
    };
  }

  if (typeof parsed.sourceContentHash !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("sourceContentHash"),
    };
  }

  if (typeof parsed.lang !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingField("lang"),
    };
  }

  const spec: CodepinSpec = {
    specVersion: parsed.specVersion,
    sourceURL: parsed.sourceURL,
    sourceContentURL: parsed.sourceContentURL,
    filename: parsed.filename,
    startLine: parsed.startLine,
    endLine: parsed.endLine,
    lang: parsed.lang ?? "", // empty string renders as a plain code block
    snippet,
    snippetHash: parsed.snippetHash,
    sourceContentHash: parsed.sourceContentHash,
  };

  const validateResult = validateSpec(spec);

  if (!validateResult.ok) {
    return validateResult;
  }

  return { ok: true, data: spec };
}

function validateSpec(spec: CodepinSpec): Result<void> {
  try {
    const url = new URL(spec.sourceURL);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return {
        ok: false,
        error: `sourceURL: ${ParseErrors.unsupportedProtocol(url.protocol)}`,
      };
    }
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidURL("sourceURL"),
    };
  }

  try {
    const url = new URL(spec.sourceContentURL);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return {
        ok: false,
        error: `sourceContentURL: ${ParseErrors.unsupportedProtocol(url.protocol)}`,
      };
    }
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidURL("sourceContentURL"),
    };
  }

  if (spec.startLine < 1 || spec.endLine < 1 || spec.startLine > spec.endLine) {
    return {
      ok: false,
      error: ParseErrors.invalidLineNumbers(),
    };
  }

  if (spec.snippet.trim().length === 0) {
    return {
      ok: false,
      error: ParseErrors.specEmptySnippet(),
    };
  }

  if (!SHA256_HEX.test(spec.snippetHash)) {
    return {
      ok: false,
      error: ParseErrors.specInvalidHash("snippetHash"),
    };
  }

  if (!SHA256_HEX.test(spec.sourceContentHash)) {
    return {
      ok: false,
      error: ParseErrors.specInvalidHash("sourceContentHash"),
    };
  }

  return { ok: true, data: undefined };
}

export async function verifySnippetIntegrity(
  spec: CodepinSpec,
): Promise<Result<void>> {
  const snippetHash = await hashContent(spec.snippet);
  if (snippetHash !== spec.snippetHash) {
    return {
      ok: false,
      error: ParseErrors.specSnippetHashMismatch(),
    };
  }

  return { ok: true, data: undefined };
}

export async function hashContent(content: string): Promise<string> {
  const normalized = content.replace(/\r\n/g, "\n");

  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, bytes);

  // Convert hash bytes into a portable hex string.
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
