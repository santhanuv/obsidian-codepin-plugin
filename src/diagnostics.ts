export const ParseErrors = {
  invalidSpec: () => "Invalid codepin block.",

  invalidPermalink: () => "Invalid 'permalink' URL.",

  invalidRawContentURL: () => "Invalid 'rawContentURL'.",

  unsupportedProtocol: (protocol: string) =>
    `Unsupported URL protocol: '${protocol}'. Expected 'https://' or 'http://'.`,

  invalidGithubPermalink: () =>
    "Expected a GitHub file permalink pointing to a code file. Example: 'https://github.com/<repo>/blob/<revision>/<path>#Lx-Ly'.",

  invalidGitlabPermalink: () =>
    "Expected a GitLab file permalink pointing to a code file. Example: 'https://gitlab.com/<repo>/-/blob/<revision>/<path>#Lx-Ly'.",

  invalidLineRange: () =>
    "Invalid line range. Expected '#Lx', '#Lx-Ly', or '#Lx-y'.",

  invalidLineNumbers: () =>
    "Invalid line numbers. Line numbers must be greater than 0 and start line must not exceed end line.",

  specSnippetLineMismatch: (endLine: number, actualLines: number) =>
    `Snippet has ${actualLines} line${actualLines === 1 ? "" : "s"} but 'endLine' is ${endLine}.`,

  invalidMetadata: () => "Invalid metadata in codepin spec.",

  specMissingMetadataSep: () =>
    "Missing metadata separator ('---') in codepin spec.",

  specMissingPermalink: () => "Missing 'permalink' field in codepin spec.",

  specMissingRawContentURL: () =>
    "Missing 'rawContentURL' field in codepin spec.",

  specMissingFilename: () => "Missing 'filename' field in codepin spec.",

  specMissingStartLine: () =>
    "Missing or invalid 'startLine' field in codepin spec.",

  specMissingEndLine: () =>
    "Missing or invalid 'endLine' field in codepin spec.",

  specMissingSnippetHash: () => "Missing 'snippetHash' field in codepin spec.",

  specMissingSourceHash: () => "Missing 'sourceHash' field in codepin spec.",

  specInvalidLang: () =>
    "Invalid 'lang' field in codepin spec. Expected a string.",

  specInvalidSnippetHash: () =>
    "Invalid 'snippetHash'. Expected a SHA-256 hex string.",

  specInvalidSourceHash: () =>
    "Invalid 'sourceHash'. Expected a SHA-256 hex string.",

  specSnippetHashMismatch: () =>
    "Invalid code snippet: the snippet content does not match 'snippetHash'.",

  specEmptySnippet: () => "codepin spec contains an empty snippet.",
};

export const HashErrors = {
  snippetHashingFailed: () => "Failed to hash snippet.",
  sourceHashingFailed: () => "Failed to hash source.",
  snippetIntegrityFailed: () =>
    "Snippet has changed since this codepin was created.",
};

export const FetchErrors = {
  fetchFailed: () => "Failed to fetch content.",

  fileNotFound: () => "Content not found. Verify the permalink or content URL.",

  accessDenied: () =>
    "Access denied or rate limit exceeded while fetching content.",

  requestFailed: (status: number) =>
    `Content request failed with status ${status}.`,
};

export function getFetchErrorMessage(status: number): string {
  switch (status) {
    case 404:
      return FetchErrors.fileNotFound();

    case 401:
    case 403:
    case 429:
      return FetchErrors.accessDenied();

    default:
      return FetchErrors.requestFailed(status);
  }
}
