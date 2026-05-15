export const ParseErrors = {
  invalidFieldFormat: (line: string) =>
    `Invalid field format. Expected 'key: value': '${line}'`,

  missingField: (field: string) => `Missing required field: '${field}'.`,

  missingValue: (field: string) =>
    `Field '${field}' requires a non-empty value.`,

  duplicateField: (field: string) => `Duplicate field: '${field}'.`,

  unknownField: (field: string) => `Unknown field: '${field}'.`,

  invalidMode: () => "Invalid 'mode' value. Expected 'code' or 'diff'.",

  invalidContext: () =>
    "Invalid 'context' value. Expected a non-negative number.",

  invalidLinesFormat: () => "Invalid 'lines' format. Expected 'start-end'.",

  invalidLineRange: () =>
    "Invalid 'lines' range. Start line must be less than or equal to end line.",

  conflictingRef: () => "Cannot specify both 'branch' and 'commit'.",
};

export const GithubErrors = {
  invalidRepositoryUrl: () =>
    "Invalid GitHub repository URL. Expected format: https://github.com/<owner>/<repo>",

  unsupportedContentEncoding: (encoding: string) =>
    `Unsupported GitHub content encoding: '${encoding}'.`,

  fetchFailed: () => "Failed to fetch GitHub file.",

  fileNotFound: () =>
    "GitHub file not found. Verify the repository URL, file path, and ref.",

  accessDenied: () => "GitHub API rate limit exceeded or access denied.",

  requestFailed: (status: number) =>
    `GitHub request failed with status ${status}.`,
};

export function getGithubFetchErrorMessage(status: number): string {
  switch (status) {
    case 404:
      return GithubErrors.fileNotFound();

    case 403:
      return GithubErrors.accessDenied();

    default:
      return GithubErrors.requestFailed(status);
  }
}
