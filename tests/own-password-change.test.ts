import { describe, expect, it, vi } from "vitest";
import { changeOwnPassword } from "@/lib/own-password-change";

function auth(user: { id: string } | null = { id: "own-account" }) {
  return { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }), updateUser: vi.fn().mockResolvedValue({ error: null }) };
}
describe("own account password change", () => {
  it("changes only the verified session owner, with current password proof", async () => {
    const client = auth();
    await changeOwnPassword(client, "test-old-only", "test-new-only", "test-new-only");
    expect(client.getUser).toHaveBeenCalledOnce();
    expect(client.updateUser).toHaveBeenCalledExactlyOnceWith({ password: "test-new-only", current_password: "test-old-only" });
  });
  it("refuses an expired session without any password update", async () => {
    const client = auth(null);
    await expect(changeOwnPassword(client, "test-old-only", "test-new-only", "test-new-only")).rejects.toThrow();
    expect(client.updateUser).not.toHaveBeenCalled();
  });
  it.each([
    ["", "test-new-only", "test-new-only"],
    ["test-old-only", "short", "short"],
    ["test-old-only", "test-new-only", "different"],
    ["test-old-only", "test-old-only", "test-old-only"],
  ])("rejects invalid password inputs before any request", async (current, next, confirm) => {
    const client = auth();
    await expect(changeOwnPassword(client, current, next, confirm)).rejects.toThrow();
    expect(client.getUser).not.toHaveBeenCalled();
    expect(client.updateUser).not.toHaveBeenCalled();
  });
  it("does not expose the provider error payload", async () => {
    const client = auth();
    client.updateUser.mockResolvedValue({ error: { message: "private-provider-detail" } });
    await expect(changeOwnPassword(client, "test-old-only", "test-new-only", "test-new-only")).rejects.not.toThrow("private-provider-detail");
  });
});