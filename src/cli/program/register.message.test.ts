import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgramContext } from "./context.js";

const createMessageCliHelpersMock = vi.fn(() => ({ helper: true }));
const registerMessageSendCommandMock = vi.fn();
const registerMessageBroadcastCommandMock = vi.fn();
const registerMessagePollCommandMock = vi.fn();
const registerMessageReactionsCommandsMock = vi.fn();
const registerMessageReadEditDeleteCommandsMock = vi.fn();
const registerMessagePinCommandsMock = vi.fn();
const registerMessagePermissionsCommandMock = vi.fn();
const registerMessageThreadCommandsMock = vi.fn();

vi.mock("./message/helpers.js", () => ({
  createMessageCliHelpers: createMessageCliHelpersMock,
}));

vi.mock("./message/register.send.js", () => ({
  registerMessageSendCommand: registerMessageSendCommandMock,
}));

vi.mock("./message/register.broadcast.js", () => ({
  registerMessageBroadcastCommand: registerMessageBroadcastCommandMock,
}));

vi.mock("./message/register.poll.js", () => ({
  registerMessagePollCommand: registerMessagePollCommandMock,
}));

vi.mock("./message/register.reactions.js", () => ({
  registerMessageReactionsCommands: registerMessageReactionsCommandsMock,
}));

vi.mock("./message/register.read-edit-delete.js", () => ({
  registerMessageReadEditDeleteCommands: registerMessageReadEditDeleteCommandsMock,
}));

vi.mock("./message/register.pins.js", () => ({
  registerMessagePinCommands: registerMessagePinCommandsMock,
}));

vi.mock("./message/register.permissions-search.js", () => ({
  registerMessagePermissionsCommand: registerMessagePermissionsCommandMock,
}));

vi.mock("./message/register.thread.js", () => ({
  registerMessageThreadCommands: registerMessageThreadCommandsMock,
}));

let registerMessageCommands: typeof import("./register.message.js").registerMessageCommands;

beforeAll(async () => {
  ({ registerMessageCommands } = await import("./register.message.js"));
});

describe("registerMessageCommands", () => {
  const ctx: ProgramContext = {
    programVersion: "9.9.9-test",
    channelOptions: ["telegram", "whatsapp"],
    messageChannelOptions: "telegram|whatsapp",
    agentChannelOptions: "last|telegram|whatsapp",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createMessageCliHelpersMock.mockReturnValue({ helper: true });
  });

  it("registers message command and wires all message sub-registrars with shared helpers", () => {
    const program = new Command();
    registerMessageCommands(program, ctx);

    const message = program.commands.find((command) => command.name() === "message");
    expect(message).toBeDefined();
    expect(createMessageCliHelpersMock).toHaveBeenCalledWith(message, "telegram|whatsapp");

    const expectedRegistrars = [
      registerMessageSendCommandMock,
      registerMessageBroadcastCommandMock,
      registerMessagePollCommandMock,
      registerMessageReactionsCommandsMock,
      registerMessageReadEditDeleteCommandsMock,
      registerMessagePinCommandsMock,
      registerMessagePermissionsCommandMock,
      registerMessageThreadCommandsMock,
    ];
    for (const registrar of expectedRegistrars) {
      expect(registrar).toHaveBeenCalledWith(message, { helper: true });
    }
  });

  it("shows command help when root message command is invoked", async () => {
    const program = new Command().exitOverride();
    registerMessageCommands(program, ctx);
    const message = program.commands.find((command) => command.name() === "message");
    expect(message).toBeDefined();
    const helpSpy = vi.spyOn(message as Command, "help").mockImplementation(() => {
      throw new Error("help-called");
    });

    await expect(program.parseAsync(["message"], { from: "user" })).rejects.toThrow("help-called");
    expect(helpSpy).toHaveBeenCalledWith({ error: true });
  });
});
