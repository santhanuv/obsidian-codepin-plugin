import { HttpClient } from "../http-client";
import { GitRef } from "../parser";

export type GitFileRequest = {
  repoUrl: string;
  path: string;
  ref: GitRef | null;
};

export type GitFileResponse =
  | { ok: true; content: string[] }
  | { ok: false; error: string };

export interface GitProvider {
  getFile(
    req: GitFileRequest,
    httpClient: HttpClient,
  ): Promise<GitFileResponse>;
}
