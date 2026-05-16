import { ParseErrors } from "./diagnostics";

const SPECIAL_FILENAMES: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Justfile: "make",
};

type RelayLineRange = { start: number; end: number | null };

type GitHost = "gitlab" | "github" | "generic";

interface GitRelayTarget {
  permalink: URL;
  host: GitHost;
  contentURL: URL;
  name: string;
  lines: RelayLineRange;
  lang?: string | undefined;
}

type ParseResult =
  | { ok: true; target: GitRelayTarget }
  | { ok: false; error: string };

type FileMetadata = { filename: string; extension?: string };

export function parseSpec(source: string): ParseResult {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0 || lines.length > 2) {
    return {
      ok: false,
      error: ParseErrors.invalidSpec(),
    };
  }

  const [permalink, langLine] = lines;

  if (!permalink) {
    return {
      ok: false,
      error: ParseErrors.missingPermalink(),
    };
  }

  let lang: string | undefined;
  if (langLine) {
    const [key, value] = langLine
      .split(":")
      .map((pair) => pair.trim())
      .filter(Boolean);

    if (key !== "lang" || !value) {
      return {
        ok: false,
        error: ParseErrors.invalidLangLine(),
      };
    }

    lang = value;
  }

  return parsePermalink(permalink, lang);
}

function parsePermalink(permalink: string, lang?: string): ParseResult {
  let sourceURL: URL;

  try {
    sourceURL = new URL(permalink);
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidPermalikLine(),
    };
  }

  if (sourceURL.protocol !== "https:" && sourceURL.protocol !== "http:") {
    return {
      ok: false,
      error: ParseErrors.unsupportedProtocol(sourceURL.protocol),
    };
  }

  let contentURL: URL;
  let host: GitHost;

  switch (sourceURL.hostname) {
    case "github.com": {
      const rawURL = toGithubRawURL(sourceURL);
      if (!rawURL) {
        return {
          ok: false,
          error: ParseErrors.invalidGithubPermalink(),
        };
      }

      contentURL = rawURL;
      host = "github";

      break;
    }

    case "gitlab.com": {
      const rawURL = toGitlabRawURL(sourceURL);
      if (!rawURL) {
        return {
          ok: false,
          error: ParseErrors.invalidGitlabPermalink(),
        };
      }

      contentURL = rawURL;
      host = "gitlab";

      break;
    }

    default: {
      contentURL = new URL(sourceURL);
      host = "generic";

      break;
    }
  }

  // hashes are renderer metadata
  contentURL.hash = "";

  let lineRange: RelayLineRange | null = { start: 1, end: null };

  if (sourceURL.hash) {
    lineRange = parseLineRange(sourceURL.hash);
    if (!lineRange) {
      return {
        ok: false,
        error: ParseErrors.invalidLineRange(),
      };
    }

    if (
      lineRange.start < 1 ||
      (lineRange.end && lineRange.start > lineRange.end)
    ) {
      return {
        ok: false,
        error: ParseErrors.invalidLineNumbers(),
      };
    }
  }

  const fileMetadata = getFileMetadata(contentURL.pathname);

  if (!lang) {
    lang = fileMetadata?.extension;
  }

  const relayTarget: GitRelayTarget = {
    permalink: sourceURL,
    host,
    contentURL: contentURL,
    lines: lineRange,
    name: fileMetadata?.filename ?? permalink.toString(),
    lang: lang,
  };

  return { ok: true, target: relayTarget };
}

function toGithubRawURL(permalink: URL): URL | null {
  const parts = permalink.pathname.split("/");

  if (parts[3] !== "blob") {
    return null;
  }

  const rawParts = [...parts];
  rawParts.splice(3, 1);

  return new URL(`https://raw.githubusercontent.com${rawParts.join("/")}`);
}

function toGitlabRawURL(permalink: URL): URL | null {
  if (!permalink.pathname.includes("/-/blob/")) {
    return null;
  }

  return new URL(
    `${permalink.origin}${permalink.pathname.replace("/-/blob/", "/-/raw/")}`,
  );
}

function parseLineRange(hash: string): RelayLineRange | null {
  const match = hash.match(/^#L(\d+)(?:-L?(\d+))?$/);

  if (!match) {
    return null;
  }

  const [, startStr, endStr] = match;

  return {
    start: startStr ? parseInt(startStr, 10) : 1,
    end: endStr ? parseInt(endStr, 10) : null,
  };
}

function getFileMetadata(pathname: string): FileMetadata | undefined {
  const filename = pathname.split("/").pop();

  if (!filename) {
    return undefined;
  }

  const special = SPECIAL_FILENAMES[filename];
  if (special) {
    return { filename, extension: special };
  }

  const extension = filename.split(".").pop();
  if (!extension) {
    return { filename };
  }

  return { filename, extension: extension };
}
