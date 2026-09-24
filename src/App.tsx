import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  CLARITIES,
  COLOR_SUGGESTIONS,
  CUTS,
  POSITIONS,
  SHAPES,
  STATUS_LABEL,
  TYPE_SUGGESTIONS,
  type Gem,
  type WorkbenchState,
} from "./types";
import { loadState, saveState, uid } from "./store";
import { PositionDiagram } from "./PositionDiagram";

/** 从尺寸文本中取最大维度，如 "6x4mm" -> 6 */
function maxDimension(size: string): number | null {
  const matches = size.match(/\d+(?:\.\d+)?/g);
  if (!matches) return null;
  return Math.max(...matches.map(Number));
}

const SIZE_FILTERS = [
  { key: "all", label: "全部尺寸", test: (_: number | null) => true },
  { key: "small", label: "＜4mm", test: (m: number | null) => m !== null && m < 4 },
  { key: "mid", label: "4–6mm", test: (m: number | null) => m !== null && m >= 4 && m <= 6 },
  { key: "large", label: "＞6mm", test: (m: number | null) => m !== null && m > 6 },
];

interface GemForm {
  code: string;
  type: string;
  shape: string;
  carat: string;
  clarity: string;
  color: string;
  cut: string;
  size: string;
  position: string;
  defect: string;
}

const emptyForm: GemForm = {
  code: "",
  type: "",
  shape: SHAPES[0],
  carat: "",
  clarity: CLARITIES[4],
  color: "",
  cut: CUTS[1],
  size: "",
  position: POSITIONS[0],
  defect: "",
};

interface Notice {
  kind: "error" | "ok";
  text: string;
}

function App() {
  const [state, setState] = useState<WorkbenchState>(loadState);
  const [form, setForm] = useState<GemForm>(emptyForm);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sizeFilter, setSizeFilter] = useState("all");
  const [newOrderName, setNewOrderName] = useState("");
  const [newBatchName, setNewBatchName] = useState("");

  // 任何状态变化都写回 localStorage，关掉页面再回来可继续
  useEffect(() => {
    saveState(state);
  }, [state]);

  const { orders, batches, gems } = state;

  const currentOrder =
    orders.find((o) => o.id === state.currentOrderId) ?? orders[0];
  const orderBatches = useMemo(
    () => batches.filter((b) => b.orderId === currentOrder?.id),
    [batches, currentOrder]
  );
  const currentBatch =
    orderBatches.find((b) => b.id === state.currentBatchId) ?? orderBatches[0];

  const orderGems = useMemo(() => {
    const ids = new Set(orderBatches.map((b) => b.id));
    return gems.filter((g) => ids.has(g.batchId));
  }, [gems, orderBatches]);

  const batchGems = useMemo(
    () => gems.filter((g) => g.batchId === currentBatch?.id),
    [gems, currentBatch]
  );

  const activeFilter =
    SIZE_FILTERS.find((f) => f.key === sizeFilter) ?? SIZE_FILTERS[0];
  const filteredBatchGems = batchGems.filter((g) =>
    activeFilter.test(maxDimension(g.size))
  );

  const pendingGems = orderGems.filter((g) => g.status === "pending");
  const readyCount = orderGems.filter((g) => g.status === "ready").length;
  const totalCarat = orderGems.reduce((sum, g) => sum + g.carat, 0);

  const batchNameOf = (batchId: string) =>
    batches.find((b) => b.id === batchId)?.name ?? "未知批次";

  // 订单清单：每个订单的总克拉、待镶嵌等随记录与状态实时汇总
  const orderSummaries = orders.map((order) => {
    const ids = new Set(
      batches.filter((b) => b.orderId === order.id).map((b) => b.id)
    );
    const gs = gems.filter((g) => ids.has(g.batchId));
    return {
      order,
      batchCount: ids.size,
      gemCount: gs.length,
      totalCarat: gs.reduce((sum, g) => sum + g.carat, 0),
      ready: gs.filter((g) => g.status === "ready").length,
      pending: gs.filter((g) => g.status === "pending").length,
      set: gs.filter((g) => g.status === "set").length,
    };
  });

  function selectOrder(orderId: string) {
    const firstBatch = batches.find((b) => b.orderId === orderId);
    setState((s) => ({
      ...s,
      currentOrderId: orderId,
      currentBatchId: firstBatch?.id ?? "",
    }));
    setNotice(null);
  }

  function selectBatch(batchId: string) {
    setState((s) => ({ ...s, currentBatchId: batchId }));
  }

  function addOrder() {
    const name =
      newOrderName.trim() || `ORD-${String(orders.length + 1).padStart(3, "0")}`;
    if (orders.some((o) => o.name === name)) {
      setNotice({ kind: "error", text: `订单「${name}」已存在` });
      return;
    }
    const orderId = uid();
    const batchId = uid();
    const now = Date.now();
    setState((s) => ({
      ...s,
      orders: [...s.orders, { id: orderId, name, createdAt: now }],
      batches: [
        ...s.batches,
        { id: batchId, name: "P1", orderId, createdAt: now },
      ],
      currentOrderId: orderId,
      currentBatchId: batchId,
    }));
    setNewOrderName("");
    setNotice({ kind: "ok", text: `已创建订单「${name}」与起始批次「P1」` });
  }

  function addBatch() {
    if (!currentOrder) return;
    const name = newBatchName.trim() || `P${orderBatches.length + 1}`;
    if (orderBatches.some((b) => b.name === name)) {
      setNotice({ kind: "error", text: `批次「${name}」已存在` });
      return;
    }
    const batchId = uid();
    setState((s) => ({
      ...s,
      batches: [
        ...s.batches,
        { id: batchId, name, orderId: currentOrder.id, createdAt: Date.now() },
      ],
      currentBatchId: batchId,
    }));
    setNewBatchName("");
    setNotice({
      kind: "ok",
      text: `已在订单「${currentOrder.name}」下新建批次「${name}」`,
    });
  }

  function addGem(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrder || !currentBatch) {
      setNotice({ kind: "error", text: "请先创建订单和批次再录入" });
      return;
    }
    const code = form.code.trim();
    const carat = Number(form.carat);
    if (!code) {
      setNotice({ kind: "error", text: "请填写宝石编号" });
      return;
    }
    if (!form.type.trim()) {
      setNotice({ kind: "error", text: "请填写种类" });
      return;
    }
    if (!form.carat || !(carat > 0)) {
      setNotice({ kind: "error", text: "请填写有效的克拉重量" });
      return;
    }
    // 同一订单内一个编号只能进入一个批次
    const dup = orderGems.find(
      (g) => g.code.toLowerCase() === code.toLowerCase()
    );
    if (dup) {
      setNotice({
        kind: "error",
        text: `编号「${dup.code}」已录入在批次「${batchNameOf(
          dup.batchId
        )}」（订单 ${currentOrder.name}），同一订单内一个编号只能进入一个批次`,
      });
      return;
    }
    const defect = form.defect.trim();
    const gem: Gem = {
      id: uid(),
      code,
      type: form.type.trim(),
      shape: form.shape,
      carat,
      clarity: form.clarity,
      color: form.color.trim() || "未标注",
      cut: form.cut,
      size: form.size.trim() || "未测量",
      position: form.position,
      defect,
      status: defect ? "pending" : "ready",
      batchId: currentBatch.id,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, gems: [...s.gems, gem] }));
    // 保留种类/形状等常用项，方便连续录入同批宝石
    setForm((f) => ({ ...f, code: "", carat: "", size: "", defect: "" }));
    setNotice({
      kind: "ok",
      text: defect
        ? `「${code}」含缺陷备注，已先放入待确认区，确认后才会进入待镶嵌`
        : `「${code}」已录入批次「${currentBatch.name}」，状态：待镶嵌`,
    });
  }

  function confirmGem(id: string) {
    setState((s) => ({
      ...s,
      gems: s.gems.map((g) =>
        g.id === id && g.status === "pending" ? { ...g, status: "ready" } : g
      ),
    }));
  }

  function toggleSet(id: string) {
    setState((s) => ({
      ...s,
      gems: s.gems.map((g) => {
        if (g.id !== id) return g;
        if (g.status === "ready") return { ...g, status: "set" };
        if (g.status === "set") return { ...g, status: "ready" };
        return g;
      }),
    }));
  }

  const set =
    (key: keyof GemForm) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62006 · 珠宝镶嵌 · 宝石分拣工作台</p>
        <h1>珠宝镶嵌宝石分拣</h1>
        <span>
          按批次录入宝石的编号、种类、形状、克拉、净度、颜色、切工、尺寸与镶嵌位置；含缺陷备注的宝石先留在待确认区，确认后才进入待镶嵌。数据保存在本机浏览器，关掉页面再回来可继续分拣。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>分拣批次（当前订单）</small>
          <strong>{orderBatches.length}</strong>
        </article>
        <article>
          <small>待镶嵌</small>
          <strong>{readyCount}</strong>
        </article>
        <article>
          <small>待确认（缺陷备注）</small>
          <strong>{pendingGems.length}</strong>
        </article>
        <article>
          <small>总克拉</small>
          <strong>{totalCarat.toFixed(2)}</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>订单与批次</h2>
          <p className="aside-label">订单</p>
          <div className="pick-list">
            {orders.map((o) => (
              <button
                key={o.id}
                className={o.id === currentOrder?.id ? "active" : ""}
                onClick={() => selectOrder(o.id)}
              >
                <span>{o.name}</span>
                <span className="cnt">
                  {batches.filter((b) => b.orderId === o.id).length} 个批次
                </span>
              </button>
            ))}
          </div>
          <div className="inline-new">
            <input
              placeholder="新订单号（可留空）"
              value={newOrderName}
              onChange={(e) => setNewOrderName(e.target.value)}
            />
            <button onClick={addOrder}>新建订单</button>
          </div>

          <p className="aside-label">当前订单的批次</p>
          <div className="pick-list">
            {orderBatches.map((b) => (
              <button
                key={b.id}
                className={b.id === currentBatch?.id ? "active" : ""}
                onClick={() => selectBatch(b.id)}
              >
                <span>批次 {b.name}</span>
                <span className="cnt">
                  {gems.filter((g) => g.batchId === b.id).length} 颗
                </span>
              </button>
            ))}
          </div>
          <div className="inline-new">
            <input
              placeholder="新批次名（可留空）"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
            />
            <button onClick={addBatch}>新建批次</button>
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>录入到当前批次</p>
              <h2>
                {currentOrder && currentBatch
                  ? `${currentOrder.name} · 批次 ${currentBatch.name}`
                  : "请先创建订单与批次"}
              </h2>
            </div>
            <button className="primary" onClick={addGem}>
              录入宝石
            </button>
          </div>
          {notice && <div className={`notice ${notice.kind}`}>{notice.text}</div>}
          <form onSubmit={addGem}>
            <div className="field-grid">
              <label>
                <span>宝石编号 *</span>
                <input
                  placeholder="如 ST-2050"
                  value={form.code}
                  onChange={set("code")}
                />
              </label>
              <label>
                <span>种类 *</span>
                <input
                  list="type-suggestions"
                  placeholder="如 蓝宝石"
                  value={form.type}
                  onChange={set("type")}
                />
                <datalist id="type-suggestions">
                  {TYPE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>形状</span>
                <select value={form.shape} onChange={set("shape")}>
                  {SHAPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>克拉重量 *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="如 1.20"
                  value={form.carat}
                  onChange={set("carat")}
                />
              </label>
              <label>
                <span>净度</span>
                <select value={form.clarity} onChange={set("clarity")}>
                  {CLARITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>颜色</span>
                <input
                  list="color-suggestions"
                  placeholder="如 皇家蓝"
                  value={form.color}
                  onChange={set("color")}
                />
                <datalist id="color-suggestions">
                  {COLOR_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label>
                <span>切工</span>
                <select value={form.cut} onChange={set("cut")}>
                  {CUTS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>尺寸</span>
                <input
                  placeholder="如 6x4mm"
                  value={form.size}
                  onChange={set("size")}
                />
              </label>
              <label>
                <span>镶嵌位置</span>
                <select value={form.position} onChange={set("position")}>
                  {POSITIONS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="span2">
                <span>缺陷备注（填写后将先进入待确认区）</span>
                <textarea
                  placeholder="无缺陷可留空；如：内含物明显，需客户确认"
                  value={form.defect}
                  onChange={set("defect")}
                />
              </label>
            </div>
          </form>
        </section>
      </section>

      <section className="duo">
        <section className="panel">
          <div className="heading">
            <div>
              <p>缺陷复核</p>
              <h2>待确认区（{pendingGems.length}）</h2>
            </div>
          </div>
          {pendingGems.length === 0 ? (
            <p className="empty">当前订单没有待确认的宝石。</p>
          ) : (
            <div className="records">
              {pendingGems.map((g) => (
                <article key={g.id}>
                  <b>
                    {g.carat.toFixed(2)}
                    <i>ct</i>
                  </b>
                  <div>
                    <h3>
                      {g.code}
                      <span className="pill pending">{STATUS_LABEL[g.status]}</span>
                    </h3>
                    <p>
                      {g.type} · {g.shape} · {g.size} · {g.clarity} · {g.color} ·{" "}
                      {g.cut} · {g.position} · 批次 {batchNameOf(g.batchId)}
                    </p>
                    <p className="defect">缺陷：{g.defect}</p>
                  </div>
                  <div className="actions">
                    <button className="confirm" onClick={() => confirmGem(g.id)}>
                      确认无误，转为待镶嵌
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>当前批次</p>
              <h2>镶嵌位置示意图</h2>
            </div>
          </div>
          <PositionDiagram gems={batchGems} />
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>当前批次清单</p>
            <h2>
              {currentOrder?.name} · 批次 {currentBatch?.name ?? "-"}（共{" "}
              {batchGems.length} 颗，筛选后 {filteredBatchGems.length} 颗）
            </h2>
          </div>
        </div>
        <div className="chips filter-chips">
          <span className="chips-label">尺寸筛选（仅作用于当前批次）：</span>
          {SIZE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={f.key === sizeFilter ? "active" : ""}
              onClick={() => setSizeFilter(f.key)}
            >
              {f.label}
              <i>
                {
                  batchGems.filter((g) => f.test(maxDimension(g.size))).length
                }
              </i>
            </button>
          ))}
        </div>
        {filteredBatchGems.length === 0 ? (
          <p className="empty">
            {batchGems.length === 0
              ? "当前批次还没有宝石，请在上方录入。"
              : "当前尺寸档位下没有宝石，换个筛选条件试试。"}
          </p>
        ) : (
          <div className="records">
            {filteredBatchGems.map((g) => (
              <article key={g.id}>
                <b>
                  {g.carat.toFixed(2)}
                  <i>ct</i>
                </b>
                <div>
                  <h3>
                    {g.code}
                    <span className={`pill ${g.status}`}>
                      {STATUS_LABEL[g.status]}
                    </span>
                  </h3>
                  <p>
                    {g.type} · {g.shape} · {g.size} · 净度 {g.clarity} ·{" "}
                    {g.color} · 切工{g.cut} · {g.position}
                  </p>
                  {g.defect && <p className="defect">缺陷：{g.defect}</p>}
                </div>
                <div className="actions">
                  {g.status === "pending" && (
                    <button className="confirm" onClick={() => confirmGem(g.id)}>
                      确认
                    </button>
                  )}
                  {g.status === "ready" && (
                    <button onClick={() => toggleSet(g.id)}>标记已镶嵌</button>
                  )}
                  {g.status === "set" && (
                    <button onClick={() => toggleSet(g.id)}>撤销已镶嵌</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>按订单查看</p>
            <h2>订单清单</h2>
          </div>
        </div>
        <div className="orders">
          {orderSummaries.map((s) => (
            <article
              key={s.order.id}
              className={s.order.id === currentOrder?.id ? "active" : ""}
            >
              <div className="order-name">
                <h3>{s.order.name}</h3>
                {s.order.id === currentOrder?.id && (
                  <span className="pill ready">当前订单</span>
                )}
              </div>
              <div className="stats">
                <span>
                  批次 <b>{s.batchCount}</b>
                </span>
                <span>
                  宝石 <b>{s.gemCount}</b>
                </span>
                <span>
                  总克拉 <b>{s.totalCarat.toFixed(2)}</b>
                </span>
                <span>
                  待镶嵌 <b>{s.ready}</b>
                </span>
                <span>
                  待确认 <b>{s.pending}</b>
                </span>
                <span>
                  已镶嵌 <b>{s.set}</b>
                </span>
              </div>
              {s.order.id !== currentOrder?.id && (
                <button onClick={() => selectOrder(s.order.id)}>
                  切换到此订单
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
