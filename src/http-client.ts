import { requestUrl } from "obsidian";

export type HttpResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: string };

export interface HttpClient {
  getJson<T>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<HttpResponse<T>>;
}

export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
): Promise<HttpResponse<T>> {
  const response = await requestUrl({
    url,
    method: "GET",
    headers,
    throw: false,
  });

  if (response.status !== 200) {
    return {
      status: response.status,
      ok: false,
      body: response.text,
    };
  }

  return {
    ok: true,
    data: response.json as T,
  };
}
