import { ParseErrors } from "../diagnostics";
import { Result } from "../result";

const SPECIAL_FILENAMES: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
  Justfile: "make",
};

type CodepinLineRange = { start: number; end: number | null };

type GitHost = "gitlab" | "github" | "generic";

type FileMetadata = { filename: string; extension?: string };

export interface CodepinTarget {
  permalink: URL;
  host: GitHost;
  contentURL: URL;
  name: string;
  lines: CodepinLineRange;
  lang?: string | undefined;
}

export function parsePermalink(permalink: string): Result<CodepinTarget> {
  let sourceURL: URL;

  try {
    sourceURL = new URL(permalink);
  } catch {
    return {
      ok: false,
      error: ParseErrors.invalidURL("permalink"),
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

  // Remove fragment identifiers from raw content URL.
  contentURL.hash = "";

  let lineRange: CodepinLineRange | null = { start: 1, end: null };

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
  const lang = fileMetadata?.extension?.toLowerCase();

  const codepinTarget: CodepinTarget = {
    permalink: sourceURL,
    host,
    contentURL: contentURL,
    lines: lineRange,
    name: fileMetadata?.filename ?? permalink.toString(),
    lang: lang,
  };

  return { ok: true, data: codepinTarget };
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

function parseLineRange(hash: string): CodepinLineRange | null {
  const match = hash.match(/^#L(\d+)(?:-L?(\d+))?$/);

  if (!match) {
    return null;
  }

  const [, startStr, endStr] = match;

  const start = startStr ? parseInt(startStr, 10) : null;
  const end = endStr ? parseInt(endStr, 10) : null;

  return {
    start: start ?? 1,
    end: end ? end : (start ?? null),
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
