import { describe, expect, it } from "vitest";
import { createRevisionGate } from "../src/conn/revisionGate";

describe("createRevisionGate", () => {
  it("首帧（含 revision 0）放行，单调递增放行", () => {
    const gate = createRevisionGate();
    expect(gate(0n)).toBe(true);
    expect(gate(1n)).toBe(true);
    expect(gate(5n)).toBe(true);
  });

  it("丢弃 <= 已重放 revision 的重叠帧（历史/实时重叠去重 §6.1）", () => {
    const gate = createRevisionGate();
    expect(gate(10n)).toBe(true); // Restore 基线 R0=10
    expect(gate(8n)).toBe(false); // 重叠旧 Output → 丢
    expect(gate(10n)).toBe(false); // 等于基线 → 丢
    expect(gate(11n)).toBe(true); // 新 → 放行
    expect(gate(11n)).toBe(false); // 再次相等 → 丢
    expect(gate(12n)).toBe(true);
  });
});
