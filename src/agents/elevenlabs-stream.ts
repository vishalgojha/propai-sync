import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, Context, Message, StopReason } from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import WebSocket from "ws";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  buildAssistantMessageWithZeroUsage,
  buildStreamErrorAssistantMessage,
} from "./stream-message-shared.js";

const log = createSubsystemLogger("elevenlabs-stream");

const ELEVENLABS_CONVAI_BASE_URL = "https://api.elevenlabs.io/v1/convai/conversation";

type ElevenLabsStreamOptions = {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
};

type ElevenLabsServerEvent = {
  type?: string;
  [key: string]: unknown;
};

function toWebSocketUrl(url: string): string {
  if (url.startsWith("wss://") || url.startsWith("ws://")) {
    return url;
  }
  if (url.startsWith("https://")) {
    return `wss://${url.slice("https://".length)}`;
  }
  if (url.startsWith("http://")) {
    return `ws://${url.slice("http://".length)}`;
  }
  return url;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function messageContentToText(message: Message): string {
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      if ((part as { type?: string }).type !== "text") {
        return "";
      }
      const text = (part as { text?: string }).text;
      return typeof text === "string" ? text : "";
    })
    .filter((text) => text.trim().length > 0)
    .join("");
}

function buildContextualUpdate(context: Context): string | null {
  const recent = context.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6);
  const lines: string[] = [];
  const systemPrompt = normalizeText(context.systemPrompt);
  if (systemPrompt) {
    lines.push(`System: ${systemPrompt}`);
  }
  for (const message of recent) {
    const text = normalizeText(messageContentToText(message));
    if (!text) {
      continue;
    }
    const prefix = message.role === "assistant" ? "Assistant" : "User";
    lines.push(`${prefix}: ${text}`);
  }
  const joined = lines.join("\n");
  return joined.trim().length > 0 ? joined : null;
}

function resolveLastUserMessage(context: Context): string | null {
  for (let i = context.messages.length - 1; i >= 0; i -= 1) {
    const message = context.messages[i];
    if (message.role !== "user") {
      continue;
    }
    const text = normalizeText(messageContentToText(message));
    if (text) {
      return text;
    }
  }
  return null;
}

async function fetchSignedUrl(params: {
  apiKey: string;
  agentId: string;
  baseUrl: string;
  signal?: AbortSignal;
}): Promise<string> {
  const baseUrl = params.baseUrl.replace(/\/+$/, "");
  const endpoint = new URL(`${baseUrl}/get-signed-url`);
  endpoint.searchParams.set("agent_id", params.agentId);
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      "xi-api-key": params.apiKey,
    },
    signal: params.signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs signed URL request failed (${response.status}): ${body || response.statusText}`,
    );
  }
  const payload = (await response.json()) as { signed_url?: string };
  if (!payload.signed_url || typeof payload.signed_url !== "string") {
    throw new Error("ElevenLabs signed URL response missing signed_url");
  }
  return payload.signed_url;
}

function resolveConversationUrl(baseUrl: string, agentId: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("agent_id", agentId);
  return toWebSocketUrl(url.toString());
}

export function createElevenLabsStreamFn(options: ElevenLabsStreamOptions = {}): StreamFn {
  return (model, context, streamOptions) => {
    const eventStream = createAssistantMessageEventStream();

    const run = async () => {
      const agentId = normalizeText(model.id);
      if (!agentId) {
        throw new Error("ElevenLabs agent id is missing (model.id).");
      }

      const apiKey = normalizeText(streamOptions?.apiKey ?? options.apiKey);
      const baseUrl = options.baseUrl?.trim() || ELEVENLABS_CONVAI_BASE_URL;
      const signal = streamOptions?.signal ?? options.signal;

      const wsUrl = apiKey
        ? await fetchSignedUrl({ apiKey, agentId, baseUrl, signal })
        : resolveConversationUrl(baseUrl, agentId);

      const socket = new WebSocket(wsUrl, apiKey ? { headers: { "xi-api-key": apiKey } } : {});

      let resolved = false;
      let responseText = "";
      const cleanup = () => {
        if (signal && abortHandler) {
          signal.removeEventListener("abort", abortHandler);
        }
      };

      const finalize = (reason: StopReason, text?: string) => {
        if (resolved) {
          return;
        }
        resolved = true;
        const finalText = (text ?? responseText).trim();
        const content: AssistantMessage["content"] = finalText
          ? [{ type: "text", text: finalText }]
          : [];
        eventStream.push({
          type: "done",
          reason: reason === "toolUse" ? "toolUse" : reason === "length" ? "length" : "stop",
          message: buildAssistantMessageWithZeroUsage({
            model,
            content,
            stopReason: reason,
          }),
        });
        eventStream.end();
        socket.close();
        cleanup();
      };

      const fail = (error: unknown) => {
        if (resolved) {
          return;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        resolved = true;
        eventStream.push({
          type: "error",
          reason: "error",
          error: buildStreamErrorAssistantMessage({ model, errorMessage }),
        });
        eventStream.end();
        socket.close();
        cleanup();
      };

      const abortHandler = () => {
        fail(new Error("aborted"));
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      eventStream.push({
        type: "start",
        partial: buildAssistantMessageWithZeroUsage({
          model,
          content: [],
          stopReason: "stop",
        }),
      });

      socket.on("open", () => {
        socket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
        const contextUpdate = buildContextualUpdate(context);
        if (contextUpdate) {
          socket.send(JSON.stringify({ type: "contextual_update", text: contextUpdate }));
        }

        const userMessage = resolveLastUserMessage(context);
        if (!userMessage) {
          fail(new Error("No user message available to send to ElevenLabs."));
          return;
        }
        socket.send(JSON.stringify({ type: "user_message", text: userMessage }));
      });

      socket.on("message", (data) => {
        let payload: ElevenLabsServerEvent;
        try {
          payload = JSON.parse(data.toString()) as ElevenLabsServerEvent;
        } catch {
          return;
        }

        const type = payload.type;
        if (type === "ping") {
          const eventId =
            (payload.ping_event as { event_id?: string | number } | undefined)?.event_id ??
            undefined;
          socket.send(JSON.stringify({ type: "pong", event_id: eventId }));
          return;
        }

        if (type === "agent_chat_response_part") {
          const partEvent = payload.text_response_part as
            | { type?: string; text?: string; event_id?: string }
            | undefined;
          const partType = partEvent?.type;
          const delta = partEvent?.text ?? "";
          if ((partType === "delta" || partType === "start" || !partType) && delta) {
            responseText += delta;
            const partialMsg = buildAssistantMessageWithZeroUsage({
              model,
              content: [{ type: "text", text: delta }],
              stopReason: "stop",
            });
            eventStream.push({
              type: "text_delta",
              contentIndex: 0,
              delta,
              partial: partialMsg,
            });
            return;
          }
          if (partType === "stop") {
            finalize("stop");
            return;
          }
        }

        if (type === "agent_response") {
          const responseTextValue = normalizeText(
            (payload.agent_response_event as { agent_response?: string } | undefined)
              ?.agent_response,
          );
          if (responseTextValue) {
            responseText = responseTextValue;
          }
          finalize("stop");
          return;
        }

        if (type === "agent_response_correction") {
          const responseTextValue = normalizeText(
            (
              payload.agent_response_correction_event as
                | { corrected_agent_response?: string }
                | undefined
            )?.corrected_agent_response,
          );
          if (responseTextValue) {
            responseText = responseTextValue;
            finalize("stop");
          }
        }
      });

      socket.on("error", (err) => {
        fail(err);
      });

      socket.on("close", (code, reason) => {
        if (!resolved) {
          fail(new Error(`WebSocket closed (code=${code}, reason=${reason.toString()})`));
        }
      });
    };

    queueMicrotask(() =>
      run().catch((err) => {
        log.warn(`[elevenlabs-stream] run error: ${err instanceof Error ? err.message : err}`);
        eventStream.push({
          type: "error",
          reason: "error",
          error: buildStreamErrorAssistantMessage({
            model,
            errorMessage: err instanceof Error ? err.message : String(err),
          }),
        });
        eventStream.end();
      }),
    );

    return eventStream;
  };
}
