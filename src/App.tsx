import { ChangeEvent, useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ---------- 数据模型 ---------- */

type GemStatus = "pending" | "ready" | "set";

interface Gem {
  id: string;
  code: string; // 宝石编号
  species: string; // 种类
  shape: string; // 形状
  carat: number; // 克拉重量
  sizeMm: number; // 尺寸（最大直径 mm）
  clarity: string; // 净度
  color: string; // 颜色
  cut: string; // 切工
  slot: string; // 镶嵌位置
  defect: string; // 缺陷备注
  status: GemStatus;
  batchId: string;
  createdAt: string;
}

interface Batch {
  id: string;
  name: string;
  createdAt: string;
}

interface Order {
  id: string;
  name: string;
  createdAt: string;
  batches: Batch[];
  gems: Gem[];
}

interface PersistedState {
  orders: Order[];
  selectedOrderId: string | null;
  selectedBatchId: string | null;
}

const STORAGE_KEY = "gem-sorting-workbench-v1";

/* ---------- 选项常量 ---------- */

const SPECIES = ["钻石", "蓝宝石", "红宝石", "祖母绿", "摩根石", "海蓝宝", "尖晶石", "碧玺", "石榴石", "其他"];
const SHAPES = ["圆形", "椭圆", "梨形", "祖母绿切", "公主方", "心形", "马眼形", "垫形"];
const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1"];
const COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "彩宝色"];
const CUTS = ["EX 完美", "VG 很好", "G 好", "F 一般", "P 差"];
const SLOTS = ["主石位", "围石A组", "围石B组", "围石C组", "肩石位(左)", "肩石位(右)"];

const SIZE_BANDS: { key: string; label: string; test: (mm: number) => boolean }[] = [
  { key: "all", label: "全部尺寸", test: () => true },
  { key: "lte3", label: "≤ 3.0 mm", test: (mm) => mm <= 3 },
  { key: "3to5", label: "3.0 – 5.0 mm", test: (mm) => mm > 3 && mm <= 5 },
  { key: "5to8", label: "5.0 – 8.0 mm", test: (mm) => mm > 5 && mm <= 8 },
  { key: "gt8", label: "> 8.0 mm", test: (mm) => mm > 8 },
];

const STATUS_TEXT: Record<GemStatus, string> = {
  pending: "待确认",
  ready: "待镶嵌",
  set: "已完成",
};

/* ---------- 初始示例数据 ---------- */

function seedOrders(): Order[] {
  const now = Date.now();
  const orderId = "ord-demo-1";
  const batchId = "bat-demo-1";
  const mk = (g: Omit<Gem, "id" | "batchId" | "createdAt" | "status">, offset: number, status: GemStatus): Gem => ({
    ...g,
    id: `gem-demo-${offset}`,
    batchId,
    status,
    createdAt: new Date(now - (3 - offset) * 60000).toISOString(),
  });
  return [
    {
      id: orderId,
      name: "星光订婚戒指订单",
      createdAt: new Date(now - 3 * 60000).toISOString(),
      batches: [{ id: batchId, name: "第一批分拣", createdAt: new Date(now - 3 * 60000).toISOString() }],
      gems: [
        mk(
          {
            code: "ST-2048",
            species: "蓝宝石",
            shape: "椭圆",
            carat: 1.82,
            sizeMm: 8.2,
            clarity: "VVS2",
            color: "彩宝色",
            cut: "EX 完美",
            slot: "主石位",
            defect: "",
          },
          1,
          "ready"
        ),
        mk(
          {
            code: "ST-2061",
            species: "钻石",
            shape: "圆形",
            carat: 0.08,
            sizeMm: 2.6,
            clarity: "VVS1",
            color: "F",
            cut: "VG 很好",
            slot: "围石A组",
            defect: "",
          },
          2,
          "ready"
        ),
        mk(
          {
            code: "ST-2099",
            species: "祖母绿",
            shape: "祖母绿切",
            carat: 0.62,
            sizeMm: 5.4,
            clarity: "SI1",
            color: "彩宝色",
            cut: "G 好",
            slot: "围石B组",
            defect: "台面内含物明显，需客户确认后再镶嵌",
          },
          3,
          "pending"
        ),
      ],
    },
  ];
}

/* ---------- 持久化 ---------- */

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (Array.isArray(parsed.orders)) {
        return {
          orders: parsed.orders,
          selectedOrderId: parsed.selectedOrderId ?? null,
          selectedBatchId: parsed.selectedBatchId ?? null,
        };
      }
    }
  } catch {
    /* 数据损坏时回退到示例 */
  }
  const orders = seedOrders();
  return { orders, selectedOrderId: orders[0].id, selectedBatchId: orders[0].batches[0].id };
}

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });

interface FormState {
  code: string;
  species: string;
  shape: string;
  carat: string;
  sizeMm: string;
  clarity: string;
  color: string;
  cut: string;
  slot: string;
  defect: string;
}

const emptyForm: FormState = {
  code: "",
  species: SPECIES[0],
  shape: SHAPES[0],
  carat: "",
  sizeMm: "",
  clarity: CLARITIES[2],
  color: COLORS[3],
  cut: CUTS[0],
  slot: SLOTS[0],
  defect: "",
};

/* ---------- 主应用 ---------- */

function App() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [sizeFilter, setSizeFilter] = useState("all");
  const [newOrderName, setNewOrderName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { orders } = state;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(t);
  }, [notice]);

  /* 当前订单 / 批次（选择失效时自动回退） */
  const currentOrder = useMemo(
    () => orders.find((o) => o.id === state.selectedOrderId) ?? orders[0] ?? null,
    [orders, state.selectedOrderId]
  );
  const currentBatch = useMemo(
    () => currentOrder?.batches.find((b) => b.id === state.selectedBatchId) ?? currentOrder?.batches[0] ?? null,
    [currentOrder, state.selectedBatchId]
  );

  /* 顶部全局指标 */
  const allGems = useMemo(() => orders.flatMap((o) => o.gems), [orders]);
  const metrics = useMemo(() => {
    const ready = allGems.filter((g) => g.status === "ready").length;
    const pending = allGems.filter((g) => g.status === "pending").length;
    const carats = round2(allGems.reduce((s, g) => s + g.carat, 0));
    const batches = orders.reduce((s, o) => s + o.batches.length, 0);
    return { batches, ready, pending, carats };
  }, [allGems, orders]);

  const patchField = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const selectOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    setState((s) => ({
      ...s,
      selectedOrderId: orderId,
      selectedBatchId: order?.batches[0]?.id ?? null,
    }));
    setSizeFilter("all");
  };

  const selectBatch = (batchId: string) => {
    setState((s) => ({ ...s, selectedBatchId: batchId }));
    setSizeFilter("all");
  };

  const createOrder = () => {
    const now = new Date().toISOString();
    const orderId = uid("ord");
    const batchId = uid("bat");
    const order: Order = {
      id: orderId,
      name: newOrderName.trim() || `订单 ${orders.length + 1}`,
      createdAt: now,
      batches: [{ id: batchId, name: "第一批分拣", createdAt: now }],
      gems: [],
    };
    setState((s) => ({ ...s, orders: [...s.orders, order], selectedOrderId: orderId, selectedBatchId: batchId }));
    setNewOrderName("");
    setNotice(`已创建订单「${order.name}」，可直接录入宝石`);
  };

  const createBatch = () => {
    if (!currentOrder) return;
    const batch: Batch = {
      id: uid("bat"),
      name: newBatchName.trim() || `第${currentOrder.batches.length + 1}批分拣`,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === currentOrder.id ? { ...o, batches: [...o.batches, batch] } : o
      ),
      selectedBatchId: batch.id,
    }));
    setNewBatchName("");
    setSizeFilter("all");
    setNotice(`已新建批次「${batch.name}」`);
  };

  const submitGem = () => {
    setError("");
    if (!currentOrder || !currentBatch) {
      setError("请先创建订单和分拣批次");
      return;
    }
    const code = form.code.trim();
    const carat = parseFloat(form.carat);
    const sizeMm = parseFloat(form.sizeMm);
    if (!code) return setError("请填写宝石编号");
    if (!Number.isFinite(carat) || carat <= 0) return setError("克拉重量需为大于 0 的数字");
    if (!Number.isFinite(sizeMm) || sizeMm <= 0) return setError("尺寸需为大于 0 的数字（mm）");

    // 同一订单内编号唯一：重复时指出原批次
    const duplicated = currentOrder.gems.find((g) => g.code.toUpperCase() === code.toUpperCase());
    if (duplicated) {
      const batchName = currentOrder.batches.find((b) => b.id === duplicated.batchId)?.name ?? "其他批次";
      setError(`编号 ${code} 已在「${batchName}」中录入，同一订单内一个编号只能进入一个批次`);
      return;
    }

    const gem: Gem = {
      id: uid("gem"),
      code,
      species: form.species,
      shape: form.shape,
      carat: round2(carat),
      sizeMm: round2(sizeMm),
      clarity: form.clarity,
      color: form.color,
      cut: form.cut,
      slot: form.slot,
      defect: form.defect.trim(),
      status: form.defect.trim() ? "pending" : "ready",
      batchId: currentBatch.id,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === currentOrder.id ? { ...o, gems: [...o.gems, gem] } : o
      ),
    }));
    setForm((f) => ({ ...emptyForm, species: f.species, shape: f.shape, clarity: f.clarity, color: f.color, cut: f.cut, slot: f.slot }));
    setNotice(
      gem.status === "pending"
        ? `${code} 含缺陷备注，已进入待确认区`
        : `${code} 已录入「${currentBatch.name}」，状态：待镶嵌`
    );
  };

  const changeStatus = (gemId: string, status: GemStatus) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === currentOrder?.id
          ? { ...o, gems: o.gems.map((g) => (g.id === gemId ? { ...g, status } : g)) }
          : o
      ),
    }));
  };

  const removeGem = (gemId: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === currentOrder?.id ? { ...o, gems: o.gems.filter((g) => g.id !== gemId) } : o
      ),
    }));
  };

  /* 当前批次经过尺寸筛选的记录 */
  const band = SIZE_BANDS.find((b) => b.key === sizeFilter) ?? SIZE_BANDS[0];
  const batchGems = useMemo(() => {
    if (!currentOrder || !currentBatch) return [];
    return currentOrder.gems
      .filter((g) => g.batchId === currentBatch.id && band.test(g.sizeMm))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [currentOrder, currentBatch, band]);

  const batchTotals = useMemo(() => {
    const gems = currentOrder?.gems.filter((g) => g.batchId === currentBatch?.id) ?? [];
    return {
      count: gems.length,
      carats: round2(gems.reduce((s, g) => s + g.carat, 0)),
      ready: gems.filter((g) => g.status === "ready").length,
    };
  }, [currentOrder, currentBatch]);

  const grouped = {
    pending: batchGems.filter((g) => g.status === "pending"),
    ready: batchGems.filter((g) => g.status === "ready"),
    set: batchGems.filter((g) => g.status === "set"),
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="kicker">hxyfront-62006 · 珠宝镶嵌工作室</p>
          <h1>宝石分拣工作台</h1>
          <span className="sub">按批次录入宝石，数据自动保存在本机，关闭页面再回来可继续分拣。</span>
        </div>
        <span className="save-tip">● 本地已自动保存</span>
      </header>

      <section className="metrics">
        <article>
          <small>分拣批次</small>
          <strong>{metrics.batches}</strong>
        </article>
        <article>
          <small>待镶嵌</small>
          <strong className="num-ready">{metrics.ready}</strong>
        </article>
        <article>
          <small>待确认（缺陷）</small>
          <strong className="num-pending">{metrics.pending}</strong>
        </article>
        <article>
          <small>总克拉</small>
          <strong>{metrics.carats.toFixed(2)}</strong>
        </article>
      </section>

      <div className="layout">
        {/* 左栏：订单 / 批次 / 示意图 */}
        <aside className="panel side">
          <section>
            <h2>订单清单</h2>
            <div className="order-list">
              {orders.map((o) => {
                const ready = o.gems.filter((g) => g.status === "ready").length;
                const carats = round2(o.gems.reduce((s, g) => s + g.carat, 0));
                return (
                  <button
                    key={o.id}
                    className={`order-card ${o.id === currentOrder?.id ? "active" : ""}`}
                    onClick={() => selectOrder(o.id)}
                  >
                    <span className="order-name">{o.name}</span>
                    <span className="order-meta">
                      {o.batches.length} 批次 · {o.gems.length} 颗 · <b>{carats.toFixed(2)}</b> ct · 待镶嵌{" "}
                      <b>{ready}</b>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="inline-create">
              <input
                value={newOrderName}
                onChange={(e) => setNewOrderName(e.target.value)}
                placeholder="新订单名称，如：客订项链"
                onKeyDown={(e) => e.key === "Enter" && createOrder()}
              />
              <button className="primary" onClick={createOrder}>
                新建订单
              </button>
            </div>
          </section>

          {currentOrder && (
            <section>
              <h2>分拣批次 · {currentOrder.name}</h2>
              <div className="batch-list">
                {currentOrder.batches.map((b) => {
                  const count = currentOrder.gems.filter((g) => g.batchId === b.id).length;
                  return (
                    <button
                      key={b.id}
                      className={`batch-tab ${b.id === currentBatch?.id ? "active" : ""}`}
                      onClick={() => selectBatch(b.id)}
                    >
                      <span>{b.name}</span>
                      <small>
                        {count} 颗 · {fmtDate(b.createdAt)}
                      </small>
                    </button>
                  );
                })}
              </div>
              <div className="inline-create">
                <input
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder={`第${currentOrder.batches.length + 1}批分拣`}
                  onKeyDown={(e) => e.key === "Enter" && createBatch()}
                />
                <button onClick={createBatch}>新增批次</button>
              </div>
            </section>
          )}

          {currentOrder && (
            <section className="diagram">
              <h2>镶嵌位置示意图</h2>
              <RingDiagram gems={currentOrder.gems} />
              <div className="legend">
                <span><i className="dot pending" />待确认</span>
                <span><i className="dot ready" />待镶嵌</span>
                <span><i className="dot set" />已完成</span>
                <span><i className="dot empty" />空位</span>
              </div>
            </section>
          )}
        </aside>

        {/* 右栏：录入 + 当前批次 */}
        <section className="panel main-col">
          <div className="heading">
            <div>
              <p className="kicker">专业字段</p>
              <h2>录入宝石</h2>
            </div>
            <span className="target">
              当前批次：<b>{currentBatch?.name ?? "—"}</b>
            </span>
          </div>

          <div className="field-grid">
            <label>
              <span>宝石编号 *</span>
              <input value={form.code} onChange={patchField("code")} placeholder="如 ST-2103" />
            </label>
            <label>
              <span>种类 *</span>
              <select value={form.species} onChange={patchField("species")}>
                {SPECIES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>形状</span>
              <select value={form.shape} onChange={patchField("shape")}>
                {SHAPES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>克拉重量 (ct) *</span>
              <input value={form.carat} onChange={patchField("carat")} inputMode="decimal" placeholder="如 0.35" />
            </label>
            <label>
              <span>尺寸 / 最大直径 (mm) *</span>
              <input value={form.sizeMm} onChange={patchField("sizeMm")} inputMode="decimal" placeholder="如 4.2" />
            </label>
            <label>
              <span>镶嵌位置</span>
              <select value={form.slot} onChange={patchField("slot")}>
                {SLOTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>净度</span>
              <select value={form.clarity} onChange={patchField("clarity")}>
                {CLARITIES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>颜色</span>
              <select value={form.color} onChange={patchField("color")}>
                {COLORS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              <span>切工</span>
              <select value={form.cut} onChange={patchField("cut")}>
                {CUTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="full">
              <span>缺陷备注（填写后自动进入待确认区）</span>
              <input
                value={form.defect}
                onChange={patchField("defect")}
                placeholder="如 腰棱有小缺口，待客户确认"
              />
            </label>
          </div>

          {error && <p className="alert error">⚠ {error}</p>}
          {notice && <p className="alert ok">✓ {notice}</p>}

          <div className="form-actions">
            <button className="primary" onClick={submitGem}>
              录入当前批次
            </button>
            <span className="hint">同一订单内编号重复时会提示原来的批次</span>
          </div>

          <div className="batch-head">
            <div>
              <h2>{currentBatch?.name ?? "暂无批次"}</h2>
              <p>
                共 {batchTotals.count} 颗 · 合计 <b>{batchTotals.carats.toFixed(2)}</b> ct · 待镶嵌{" "}
                <b>{batchTotals.ready}</b>
              </p>
            </div>
            <div className="size-filter">
              <span>尺寸筛选（仅当前批次）</span>
              <div className="chips">
                {SIZE_BANDS.map((b) => (
                  <button
                    key={b.key}
                    className={b.key === sizeFilter ? "chip-on" : ""}
                    onClick={() => setSizeFilter(b.key)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!currentBatch && <p className="empty">请先在左侧新建订单或批次。</p>}
          {currentBatch && batchGems.length === 0 && (
            <p className="empty">当前筛选下没有记录，换个尺寸段或录入新宝石。</p>
          )}

          {grouped.pending.length > 0 && (
            <GemZone
              title="待确认区"
              tone="pending"
              desc="含缺陷备注，确认后方可完成镶嵌"
              gems={grouped.pending}
              currentOrder={currentOrder!}
              onConfirm={(id) => changeStatus(id, "ready")}
              onSet={(id) => changeStatus(id, "set")}
              onReopen={(id) => changeStatus(id, "ready")}
              onRemove={removeGem}
            />
          )}
          {grouped.ready.length > 0 && (
            <GemZone
              title="待镶嵌"
              tone="ready"
              desc="已确认，等待上镶"
              gems={grouped.ready}
              currentOrder={currentOrder!}
              onSet={(id) => changeStatus(id, "set")}
              onReopen={(id) => changeStatus(id, "ready")}
              onRemove={removeGem}
            />
          )}
          {grouped.set.length > 0 && (
            <GemZone
              title="已完成"
              tone="set"
              desc="已镶嵌完成"
              gems={grouped.set}
              currentOrder={currentOrder!}
              onSet={(id) => changeStatus(id, "set")}
              onReopen={(id) => changeStatus(id, "ready")}
              onRemove={removeGem}
            />
          )}
        </section>
      </div>

      {/* 订单清单：每单的总克拉与待镶嵌数量 */}
      <section className="panel manifest">
        <div className="heading">
          <div>
            <p className="kicker">按订单查看</p>
            <h2>订单宝石清单</h2>
          </div>
        </div>
        <div className="manifest-grid">
          {orders.map((o) => {
            const carats = round2(o.gems.reduce((s, g) => s + g.carat, 0));
            const ready = o.gems.filter((g) => g.status === "ready").length;
            const pending = o.gems.filter((g) => g.status === "pending").length;
            return (
              <article key={o.id} className="manifest-card">
                <h3>{o.name}</h3>
                <p className="manifest-stats">
                  总克拉 <b>{carats.toFixed(2)}</b> ct · 待镶嵌 <b>{ready}</b> 颗 · 待确认 <b>{pending}</b> 颗 · 共{" "}
                  {o.gems.length} 颗
                </p>
                <div className="manifest-batches">
                  {o.batches.map((b) => {
                    const gems = o.gems.filter((g) => g.batchId === b.id);
                    return (
                      <div key={b.id} className="manifest-batch">
                        <p className="manifest-batch-head">
                          {b.name} <span>{gems.length} 颗</span>
                        </p>
                        <div className="code-chips">
                          {gems.length === 0 && <span className="muted">暂无记录</span>}
                          {gems
                            .slice()
                            .sort((a, b2) => a.createdAt.localeCompare(b2.createdAt))
                            .map((g) => (
                              <span key={g.id} className={`code-chip ${g.status}`} title={`${g.species} · ${g.carat}ct · ${STATUS_TEXT[g.status]}${g.defect ? " · " + g.defect : ""}`}>
                                {g.code}
                              </span>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

/* ---------- 宝石分区 ---------- */

interface ZoneProps {
  title: string;
  desc: string;
  tone: GemStatus;
  gems: Gem[];
  currentOrder: Order;
  onConfirm?: (id: string) => void;
  onSet: (id: string) => void;
  onReopen: (id: string) => void;
  onRemove: (id: string) => void;
}

function GemZone({ title, desc, tone, gems, currentOrder, onConfirm, onSet, onReopen, onRemove }: ZoneProps) {
  return (
    <section className={`zone zone-${tone}`}>
      <div className="zone-head">
        <h3>
          <i className={`badge ${tone}`}>{STATUS_TEXT[tone]}</i>
          {title} <small>{gems.length}</small>
        </h3>
        <span className="muted">{desc}</span>
      </div>
      <div className="gem-grid">
        {gems.map((g) => {
          const batchName = currentOrder.batches.find((b) => b.id === g.batchId)?.name;
          return (
            <article key={g.id} className="gem-card">
              <div className="gem-card-head">
                <h4>{g.code}</h4>
                <span className={`slot-tag`}>{g.slot}</span>
              </div>
              <p className="gem-line">
                {g.species} · {g.shape} · <b>{g.carat}</b> ct · {g.sizeMm} mm
              </p>
              <p className="gem-line muted">
                净度 {g.clarity} · 颜色 {g.color} · 切工 {g.cut} · {batchName}
              </p>
              {g.defect && <p className="defect-note">缺陷：{g.defect}</p>}
              <div className="gem-actions">
                {g.status === "pending" && (
                  <button className="mini confirm" onClick={() => onConfirm?.(g.id)}>
                    确认无缺陷
                  </button>
                )}
                {g.status === "ready" && (
                  <button className="mini set" onClick={() => onSet(g.id)}>
                    完成镶嵌
                  </button>
                )}
                {g.status === "set" && (
                  <button className="mini ghost" onClick={() => onReopen(g.id)}>
                    重新打开
                  </button>
                )}
                <button className="mini danger" onClick={() => onRemove(g.id)}>
                  移除
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- 镶嵌位置示意图 ---------- */

const DIAGRAM_SLOTS: { name: string; x: number; y: number; r: number }[] = [
  { name: "主石位", x: 100, y: 96, r: 17 },
  // 围石A组（顶部弧）
  { name: "围石A组", x: 50, y: 48, r: 9 },
  { name: "围石A组", x: 80, y: 34, r: 9 },
  { name: "围石A组", x: 120, y: 34, r: 9 },
  { name: "围石A组", x: 150, y: 48, r: 9 },
  // 围石B组（两侧）
  { name: "围石B组", x: 30, y: 96, r: 9 },
  { name: "围石B组", x: 45, y: 120, r: 9 },
  { name: "围石B组", x: 155, y: 120, r: 9 },
  { name: "围石B组", x: 170, y: 96, r: 9 },
  // 围石C组（底部弧）
  { name: "围石C组", x: 50, y: 144, r: 9 },
  { name: "围石C组", x: 80, y: 158, r: 9 },
  { name: "围石C组", x: 120, y: 158, r: 9 },
  { name: "围石C组", x: 150, y: 144, r: 9 },
  // 肩石
  { name: "肩石位(左)", x: 14, y: 74, r: 8 },
  { name: "肩石位(右)", x: 186, y: 74, r: 8 },
];

const STATUS_COLOR: Record<GemStatus, string> = {
  pending: "#d97706",
  ready: "#0f766e",
  set: "#16a34a",
};

function RingDiagram({ gems }: { gems: Gem[] }) {
  const worst = (list: Gem[]): GemStatus | null => {
    if (list.some((g) => g.status === "pending")) return "pending";
    if (list.some((g) => g.status === "ready")) return "ready";
    if (list.length > 0) return "set";
    return null;
  };

  return (
    <svg viewBox="0 0 200 188" className="ring-svg" role="img" aria-label="镶嵌位置示意图">
      <ellipse cx="100" cy="96" rx="72" ry="66" fill="none" stroke="#d9e2ef" strokeWidth="7" />
      <rect x="84" y="166" width="32" height="10" rx="3" fill="#e2e8f0" />
      {DIAGRAM_SLOTS.map((slot, i) => {
        const list = gems.filter((g) => g.slot === slot.name);
        const status = worst(list);
        const color = status ? STATUS_COLOR[status] : "#e2e8f0";
        return (
          <g key={`${slot.name}-${i}`}>
            <circle cx={slot.x} cy={slot.y} r={slot.r} fill={color} />
            {status && (
              <text
                x={slot.x}
                y={slot.y + (slot.r > 12 ? 5 : 3.5)}
                textAnchor="middle"
                fontSize={slot.r > 12 ? 13 : 9}
                fill="#ffffff"
                fontWeight={700}
              >
                {list.length}
              </text>
            )}
            <title>{`${slot.name}：${list.length} 颗${status ? "（" + STATUS_TEXT[status] + "）" : "（空位）"}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export default App;
