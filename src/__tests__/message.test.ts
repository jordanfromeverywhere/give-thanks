import { describe, it, expect } from "vitest";
import { buildMessage } from "../message.js";

describe("buildMessage", () => {
  it("builds default message without usedFor", () => {
    const msg = buildMessage({ packageName: "chalk" });
    expect(msg.title).toBe("Thanks for building chalk!");
    expect(msg.body).toContain("**chalk**");
    expect(msg.body).toContain("in my work and wanted");
    expect(msg.body).toContain("give-thanks");
  });

  it("includes usedFor in body", () => {
    const msg = buildMessage({
      packageName: "chalk",
      usedFor: "colorful CLI output",
    });
    expect(msg.body).toContain("for colorful CLI output");
  });

  it("uses custom message when provided", () => {
    const msg = buildMessage({
      packageName: "chalk",
      customMessage: "You rock!",
    });
    expect(msg.title).toBe("Thanks for building chalk!");
    expect(msg.body).toContain("You rock!");
    expect(msg.body).not.toContain("in my work");
    expect(msg.body).toContain("give-thanks"); // footer still present
  });

  it("includes footer link in all messages", () => {
    const defaultMsg = buildMessage({ packageName: "x" });
    const customMsg = buildMessage({ packageName: "x", customMessage: "Hi" });
    expect(defaultMsg.body).toContain("jordanfromeverywhere/give-thanks");
    expect(customMsg.body).toContain("jordanfromeverywhere/give-thanks");
  });
});
