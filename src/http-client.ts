import { requestUrl } from "obsidian";

export type FetchTextResult =
  | { ok: true; text: string }
  | { ok: false; status: number; body: string };

export async function fetchText(url: string): Promise<FetchTextResult> {
  const response = await requestUrl({
    url,
    method: "GET",
    throw: false,
  });

  if (response.status !== 200) {
    return {
      ok: false,
      status: response.status,
      body: response.text,
    };
  }

  return {
    ok: true,
    text: response.text,
  };
}
