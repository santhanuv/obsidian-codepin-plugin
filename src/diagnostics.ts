export const ParseErrors = {
  invalidSpec: () => "Invalid codepin block.",

  invalidURL: (fieldName: string) => `Invalid '${fieldName}'`,

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

  specMissingField: (fieldName: string) =>
    `Missing '${fieldName}' field in codepin spec.`,

  specInvalidHash: (fieldName: string) =>
    `Invalid '${fieldName}'. Expected a SHA-256 hex string.`,

  specSnippetHashMismatch: () =>
    "Invalid code snippet: the snippet content does not match 'snippetHash'.",

  specEmptySnippet: () =>
    "Snippet should contain atleast one non-empty character.",
};

export const HashErrors = {
  snippetHashingFailed: () => "Failed to hash snippet.",

  sourceContentHashingFailed: () => "Failed to hash source content.",

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
