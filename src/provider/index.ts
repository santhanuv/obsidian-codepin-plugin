import { getJson, HttpClient } from "../http-client";
import { githubProvider } from "./github-provider";
import { GitFileRequest, GitFileResponse } from "./types";

export async function getGitFile(
  req: GitFileRequest,
): Promise<GitFileResponse> {
  const httpClient: HttpClient = { getJson };
  return await githubProvider.getFile(req, httpClient);
}
