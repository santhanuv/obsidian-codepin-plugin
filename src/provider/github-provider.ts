import { GitProvider, GitFileRequest, GitFileResponse } from "./types";
import { HttpClient } from "../http-client";
import { getGithubFetchErrorMessage, GithubErrors } from "../diagnostics";

const GITHUB_API_VERSION = "2026-03-10";

export type GithubContentApiResponse = {
  content: string;
  encoding: string;
};

type ParsedGithubRepository = {
  owner: string;
  repo: string;
};

export const githubProvider: GitProvider = {
  async getFile(
    req: GitFileRequest,
    httpClient: HttpClient,
  ): Promise<GitFileResponse> {
    try {
      const githubRepo = parseGithubRepository(req.repoUrl);
      if (!githubRepo) {
        return {
          ok: false,
          error: GithubErrors.invalidRepositoryUrl(),
        };
      }

      const url = new URL(
        `https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}/contents/${req.path}`,
      );

      if (req.ref) {
        url.searchParams.set("ref", req.ref.value);
      }

      const response = await httpClient.getJson<GithubContentApiResponse>(
        url.toString(),
        {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      );

      if (!response.ok) {
        console.error("GitHub request failed", response.body, response.status);

        return {
          ok: false,
          error: getGithubFetchErrorMessage(response.status),
        };
      }

      if (response.data.encoding !== "base64") {
        return {
          ok: false,
          error: GithubErrors.unsupportedContentEncoding(
            response.data.encoding,
          ),
        };
      }
      const content = decodeBase64(response.data.content);

      return {
        ok: true,
        content: content.split("\n"),
      };
    } catch (error) {
      console.error("GitHub fetch failed", error);

      return {
        ok: false,
        error: GithubErrors.fetchFailed(),
      };
    }
  },
};

function parseGithubRepository(
  repository: string,
): ParsedGithubRepository | null {
  let url: URL;

  try {
    url = new URL(repository);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const owner = parts[0];
  if (!owner) {
    return null;
  }

  let repo = parts[1];
  if (!repo) {
    return null;
  }

  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  return {
    owner,
    repo,
  };
}

function decodeBase64(base64: string): string {
  // GitHub Contents API may return base64 content wrapped with newlines.
  // Normalize before decoding to avoid decoder inconsistencies.
  const normalized = base64.replace(/\n/g, "");

  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}
