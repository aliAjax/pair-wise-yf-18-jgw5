import type { WorkbenchState } from "./types";

const STORAGE_KEY = "hxyfront-62006-gem-workbench-v1";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 首次打开时的演示数据（来自原静态样例的三条记录） */
export function seedState(): WorkbenchState {
  const now = Date.now();
  const orderId = uid();
  const batchId = uid();
  return {
    orders: [{ id: orderId, name: "ORD-2026-001", createdAt: now }],
    batches: [{ id: batchId, name: "P1", orderId, createdAt: now }],
    gems: [
      {
        id: uid(),
        code: "ST-2048",
        type: "蓝宝石",
        shape: "椭圆",
        carat: 1.2,
        clarity: "VVS1",
        color: "皇家蓝",
        cut: "非常好",
        size: "6x4mm",
        position: "主石位",
        defect: "",
        status: "ready",
        batchId,
        createdAt: now,
      },
      {
        id: uid(),
        code: "ST-2061",
        type: "钻石",
        shape: "圆形",
        carat: 0.08,
        clarity: "VS1",
        color: "白",
        cut: "理想",
        size: "1.3mm",
        position: "围石A组",
        defect: "",
        status: "ready",
        batchId,
        createdAt: now + 1,
      },
      {
        id: uid(),
        code: "ST-2099",
        type: "祖母绿",
        shape: "祖母绿切",
        carat: 0.9,
        clarity: "SI1",
        color: "翠绿",
        cut: "好",
        size: "5x4mm",
        position: "副石位",
        defect: "内含物明显，需客户确认",
        status: "pending",
        batchId,
        createdAt: now + 2,
      },
    ],
    currentOrderId: orderId,
    currentBatchId: batchId,
  };
}

export function loadState(): WorkbenchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as WorkbenchState;
    if (
      !Array.isArray(parsed.orders) ||
      !Array.isArray(parsed.batches) ||
      !Array.isArray(parsed.gems) ||
      parsed.orders.length === 0
    ) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: WorkbenchState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，不影响当前会话使用
  }
}
