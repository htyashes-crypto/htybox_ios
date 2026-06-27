import { shouldDrop } from "@htybox/link";

/**
 * 每个终端订阅一个：按 revision 去重（spec §6.1）。
 * 历史重放（Restore，基线 R0）与实时 Output 流可能在 R0 处重叠，丢弃 revision <= 已重放值的帧。
 * 初始 -1，故首帧（含 revision 0）必放行。返回 true = 应渲染。
 */
export function createRevisionGate(): (revision: bigint) => boolean {
  let replayed = -1n;
  return (revision: bigint): boolean => {
    if (shouldDrop(revision, replayed)) return false;
    replayed = revision;
    return true;
  };
}
