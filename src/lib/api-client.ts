import { Health, type PlanRequest, PlanResponse } from "./schema/api";

const URL_PATH = "/api/plan";
const UNAVAILABLE: PlanResponse = {
  ok: false,
  error: {
    code: "upstream",
    message: "Service unavailable, try again or use a preset",
  },
};

type FetchFn = typeof fetch;

async function call(fetchFn: FetchFn, init?: RequestInit): Promise<unknown> {
  const res = await fetchFn(URL_PATH, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  return res.json();
}

export async function getHealth(fetchFn: FetchFn = fetch): Promise<Health> {
  try {
    const parsed = Health.safeParse(await call(fetchFn));
    return parsed.success ? parsed.data : { live_available: false };
  } catch {
    return { live_available: false };
  }
}

export async function postPlan(
  body: PlanRequest,
  fetchFn: FetchFn = fetch,
): Promise<PlanResponse> {
  try {
    const json = await call(fetchFn, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = PlanResponse.safeParse(json);
    return parsed.success ? parsed.data : UNAVAILABLE;
  } catch {
    return UNAVAILABLE;
  }
}
