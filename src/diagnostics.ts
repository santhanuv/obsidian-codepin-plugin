export const ParseErrors = {
  invalidSpec: () =>
    "Invalid git-relay block. Expected a permalink on line 1 and optional metadata on line 2 only.",

  missingPermalink: () =>
    "Missing permalink on line 1. Expected a GitHub, GitLab, or raw content URL.",

  invalidPermalikLine: () => "Invalid line 1. Expected a permalink URL.",

  invalidLangLine: () =>
    "Invalid line 2. Expected a metadata field in the format 'key: value'.",

  unsupportedProtocol: (protocol: string) =>
    `Unsupported URL protocol: '${protocol}'. Expected 'https://' or 'http://'.`,

  invalidGithubPermalink: () =>
    "Expected a GitHub file permalink pointing to a code file. Example: 'https://github.com/<repo>/blob/<revision>/<path>#Lx-Ly'.",

  invalidGitlabPermalink: () =>
    "Expected a GitLab file permalink pointing to a code file. Example: 'https://gitlab.com/<repo>/-/blob/<revision>/<path>#Lx-Ly'.",

  invalidLineRange: () =>
    "Invalid line range. Expected '#Lx', '#Lx-Ly', or '#Lx-y'.",

  invalidLineNumbers: () =>
    "Line numbers must be greater than 0 and start line must not exceed end line.",
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
