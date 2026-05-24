import YAML from "yaml";
import { Result } from "../result";
import { CodepinTarget } from "./permalink";
import { HashErrors, ParseErrors } from "../diagnostics";

const HASH_ALGORITHM = "SHA-256";
const SHA256_HEX = /^[a-f0-9]{64}$/;

export interface CodepinSpec {
  permalink: string;
  rawContentURL: string;
  filename: string;
  startLine: number;
  endLine: number;
  lang: string;
  snippet: string;
  snippetHash: string;
  sourceHash: string;
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
  const resolvedEndLine = endLine ?? fileLines.length;
  if (resolvedEndLine > fileLines.length) {
    return {
      ok: false,
      error: ParseErrors.specSnippetLineMismatch(
        resolvedEndLine,
        fileLines.length,
      ),
    };
  }

  let snippetLines = fileLines.slice(startLine - 1, resolvedEndLine);

  const isPartialSnippet =
    startLine !== 1 || resolvedEndLine !== fileLines.length;
  if (isPartialSnippet) {
    snippetLines = dedent(snippetLines);
  }

  const lang = target.lang ?? "";
  const snippet = snippetLines.join("\n");

  let snippetHash: string;
  try {
    snippetHash = await hashContent(snippet);
  } catch (error) {
    console.error("[codepin]", "Failed to hash snippet", error);
    return { ok: false, error: HashErrors.snippetHashingFailed() };
  }

  let sourceHash: string;
  try {
    sourceHash = await hashContent(content);
  } catch (error) {
    console.error("[codepin]", "Failed to hash source", error);
    return { ok: false, error: HashErrors.sourceHashingFailed() };
  }

  const spec: CodepinSpec = {
    permalink: target.permalink.toString(),
    rawContentURL: target.contentURL.toString(),
    filename: target.name,
    startLine: startLine,
    endLine: resolvedEndLine,
    lang: lang,
    snippet: snippet,
    snippetHash: snippetHash,
    sourceHash: sourceHash,
  };

  return { ok: true, data: spec };
}

export function encodeSpec(spec: CodepinSpec): string {
  const metadata = {
    permalink: spec.permalink,
    rawContentURL: spec.rawContentURL,
    filename: spec.filename,
    startLine: spec.startLine,
    endLine: spec.endLine,
    lang: spec.lang,
    snippetHash: spec.snippetHash,
    sourceHash: spec.sourceHash,
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
  const metadata = YAML.parse(metadataText) as unknown;
  if (typeof metadata !== "object" || metadata === null) {
    return {
      ok: false,
      error: ParseErrors.invalidMetadata(),
    };
  }
  const parsed = metadata as Partial<CodepinSpec>;

  if (typeof parsed.permalink !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingPermalink(),
    };
  }

  if (typeof parsed.rawContentURL !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingRawContentURL(),
    };
  }

  if (typeof parsed.filename !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingFilename(),
    };
  }

  if (
    typeof parsed.startLine !== "number" ||
    !Number.isInteger(parsed.startLine)
  ) {
    return {
      ok: false,
      error: ParseErrors.specMissingStartLine(),
    };
  }

  if (typeof parsed.endLine !== "number" || !Number.isInteger(parsed.endLine)) {
    return {
      ok: false,
      error: ParseErrors.specMissingEndLine(),
    };
  }

  if (typeof parsed.snippetHash !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingSnippetHash(),
    };
  }

  if (typeof parsed.sourceHash !== "string") {
    return {
      ok: false,
      error: ParseErrors.specMissingSourceHash(),
    };
  }

  if (parsed.lang !== undefined && typeof parsed.lang !== "string") {
    return {
      ok: false,
      error: ParseErrors.specInvalidLang(),
    };
  }

  const spec: CodepinSpec = {
    permalink: parsed.permalink,
    rawContentURL: parsed.rawContentURL,
    filename: parsed.filename,
    startLine: parsed.startLine,
    endLine: parsed.endLine,
    lang: parsed.lang ?? "", // empty string renders as a plain code block
    snippet,
    snippetHash: parsed.snippetHash,
    sourceHash: parsed.sourceHash,
  };

  const validateResult = validateSpec(spec);

  if (!validateResult.ok) {
    return validateResult;
  }

  return { ok: true, data: spec };
}

function validateSpec(spec: CodepinSpec): Result<void> {
  try {
    const url = new URL(spec.permalink);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return {
        ok: false,
        error: `Permalink: ${ParseErrors.unsupportedProtocol(url.protocol)}`,
      };
    }
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidPermalink(),
    };
  }

  try {
    const url = new URL(spec.rawContentURL);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return {
        ok: false,
        error: `rawContentURL: ${ParseErrors.unsupportedProtocol(url.protocol)}`,
      };
    }
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidRawContentURL(),
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
      error: ParseErrors.specInvalidSnippetHash(),
    };
  }

  if (!SHA256_HEX.test(spec.sourceHash)) {
    return {
      ok: false,
      error: ParseErrors.specInvalidSourceHash(),
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
