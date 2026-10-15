import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { applyCaptions } from "../report/report";
import { Mission } from "../schema/mission";
import { planUserMessage, repairUserMessage, SYSTEM_PROMPT } from "./prompts";
import { type Provider, UpstreamError } from "./types";

export const PLAN_MODEL = "claude-sonnet-5-5";
export const CAPTION_MODEL = "claude-haiku-5-5";

const Captions = z
  .object({
    captions: z.array(
      z.object({ poi_id: z.string(), caption: z.string().max(200) }).strict(),
    ),
  })
  .strict();

const CAPTION_SYSTEM =
  "Write one short factual caption per finding. Describe only what the finding's evidence shows. Do not invent frames or details.";

export function createAnthropicProvider(
  client: Pick<Anthropic, "messages">,
): Provider {
  async function call<T extends z.ZodType>(
    model: string,
    system: string,
    user: string,
    schema: T,
  ): Promise<z.infer<T>> {
    try {
      const res = await client.messages.parse({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(schema) },
      });
      if (res.stop_reason === "refusal") throw new Error("refusal");
      return schema.parse(res.parsed_output);
    } catch (cause) {
      throw new UpstreamError("The planning service failed", { cause });
    }
  }

  return {
    name: "anthropic",
    plan: ({ scenario, request, area }) =>
      call(
        PLAN_MODEL,
        SYSTEM_PROMPT,
        planUserMessage(scenario, request, area),
        Mission,
      ),
    repair: ({ scenario, request, mission, violations, round }) =>
      call(
        PLAN_MODEL,
        SYSTEM_PROMPT,
        repairUserMessage(scenario, request, mission, violations, round),
        Mission,
      ),
    async caption({ findings }) {
      const user = JSON.stringify(
        findings.map((f) => ({
          poi_id: f.poi_id,
          label: f.label,
          status: f.status,
          frame_ids: f.evidence.map((e) => e.frame_id),
        })),
      );
      const { captions } = await call(
        CAPTION_MODEL,
        CAPTION_SYSTEM,
        user,
        Captions,
      );
      return applyCaptions(
        findings,
        Object.fromEntries(captions.map((c) => [c.poi_id, c.caption])),
      );
    },
  };
}
