import { describe, expect, it } from "vitest";
import { looksLikeTelegramTargetId, normalizeTelegramMessagingTarget } from "./telegram.js";
import { looksLikeWhatsAppTargetId, normalizeWhatsAppMessagingTarget } from "./whatsapp.js";

describe("normalize target helpers", () => {
  describe("Telegram", () => {
    it("normalizes blank inputs to undefined", () => {
      expect(normalizeTelegramMessagingTarget("   ")).toBeUndefined();
    });

    it("detects common Telegram target forms", () => {
      expect(looksLikeTelegramTargetId("@channel")).toBe(true);
      expect(looksLikeTelegramTargetId("t.me/mychannel")).toBe(true);
      expect(looksLikeTelegramTargetId("-1001234567890")).toBe(true);
      expect(looksLikeTelegramTargetId("")).toBe(false);
    });
  });

  describe("WhatsApp", () => {
    it("normalizes blank inputs to undefined", () => {
      expect(normalizeWhatsAppMessagingTarget("   ")).toBeUndefined();
    });

    it("detects common WhatsApp target forms", () => {
      expect(looksLikeWhatsAppTargetId("whatsapp:+15555550123")).toBe(true);
      expect(looksLikeWhatsAppTargetId("15555550123@c.us")).toBe(true);
      expect(looksLikeWhatsAppTargetId("+15555550123")).toBe(true);
      expect(looksLikeWhatsAppTargetId("")).toBe(false);
    });
  });
});
