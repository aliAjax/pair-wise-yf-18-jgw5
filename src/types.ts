export type GemStatus = "pending" | "ready" | "set";

export interface Gem {
  id: string;
  code: string; // 宝石编号（同一订单内唯一）
  type: string; // 种类
  shape: string; // 形状
  carat: number; // 克拉重量
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  size: string; // 尺寸，如 6x4mm
  position: string; // 镶嵌位置
  defect: string; // 缺陷备注，非空则先进入待确认区
  status: GemStatus;
  batchId: string;
  createdAt: number;
}

export interface Batch {
  id: string;
  name: string;
  orderId: string;
  createdAt: number;
}

export interface Order {
  id: string;
  name: string;
  createdAt: number;
}

export interface WorkbenchState {
  orders: Order[];
  batches: Batch[];
  gems: Gem[];
  currentOrderId: string;
  currentBatchId: string;
}

export const STATUS_LABEL: Record<GemStatus, string> = {
  pending: "待确认",
  ready: "待镶嵌",
  set: "已镶嵌",
};

export const SHAPES = [
  "圆形",
  "椭圆",
  "梨形",
  "祖母绿切",
  "公主方",
  "垫形",
  "马眼",
  "心形",
  "随形",
];

export const CLARITIES = [
  "FL",
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "I1",
  "I2",
];

export const CUTS = ["理想", "非常好", "好", "一般"];

export const POSITIONS = ["主石位", "围石A组", "围石B组", "副石位", "戒臂"];

export const TYPE_SUGGESTIONS = [
  "钻石",
  "蓝宝石",
  "红宝石",
  "祖母绿",
  "翡翠",
  "尖晶石",
  "碧玺",
  "坦桑石",
  "海蓝宝",
];

export const COLOR_SUGGESTIONS = [
  "白",
  "皇家蓝",
  "矢车菊蓝",
  "鸽血红",
  "翠绿",
  "艳粉",
  "金黄",
  "香槟",
  "紫罗兰",
];
