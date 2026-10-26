"use client";
import { useEffect, useRef, useState } from "react";
import FOODS from "../data/foods.json";
import * as AD from "@radix-ui/react-alert-dialog";
import { K, MEALS, LIM, colorOf, calc, migrate } from "../lib/data";

const STORE = "nutrition-tracker-v1";
const fmt = (x) => (x >= 100 ? Math.round(x).toLocaleString() : Math.round(x * 10) / 10);
const uid = () => Date.now() + Math.random();

function useCount(v) {
  const [n, setN] = useState(0), from = useRef(0);
  useEffect(() => {
    const a = from.current, t0 = performance.now();
    let id;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 800), x = a + (v - a) * (1 - Math.pow(1 - p, 3));
      from.current = x; setN(x);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [v]);
  return n;
}
const Count = ({ v }) => fmt(useCount(v));

function Bar({ p, color, warn }) {
  const [w, setW] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setW(Math.min(100, p * 100))); return () => cancelAnimationFrame(id); }, [p]);
  return <div className="bar"><i style={{ width: w + "%", background: warn ? "#f87171" : color }} /></div>;
}

function Ring({ value, target }) {
  const R = 88, C = 2 * Math.PI * R, p = target > 0 ? Math.min(1, value / target) : 0;
  const [off, setOff] = useState(C);
  useEffect(() => { const id = requestAnimationFrame(() => setOff(C * (1 - p))); return () => cancelAnimationFrame(id); }, [p, C]);
  const over = value > target;
  return (
    <div className="ringw">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle className="t" cx="100" cy="100" r={R} />
        <circle className="p" cx="100" cy="100" r={R} stroke={over ? "#f87171" : "#fff"} strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <div className="ringc">
        <span className="big"><Count v={value} /></span>
        <span className="mu">of {fmt(target)} kcal</span>
      </div>
    </div>
  );
}

function Sheet({ onClose, children }) {
  return <div className="ov" onClick={onClose}><div className="sh" onClick={(e) => e.stopPropagation()}>{children}</div></div>;
}

function AddEntry({ S, meal, edit, onAdd, onClose }) {
  const [q, setQ] = useState(""), [food, setFood] = useState(edit ? S.foods.find((f) => f.n === edit.food) || null : null), [qty, setQty] = useState(edit ? String(edit.qty) : ""), [unit, setUnit] = useState(edit ? edit.unit : ""), [m, setM] = useState(meal);
  const list = S.foods.filter((f) => f.n.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const base = food && S.units.find((u) => u.u === food.u);
  const units = base ? S.units.filter((u) => u.g === base.g) : [];
  const c = food ? calc(S, { food: food.n, qty: qty === "" ? "" : +qty, unit }) : { ok: false };
  return (
    <Sheet onClose={onClose}>
      <h2>{edit ? "Edit entry" : `Add to ${m}`}</h2>
      {!food ? (<>
        <input autoFocus placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.map((f) => <div key={f.n} className="item" onClick={() => { setFood(f); setUnit(""); }}><div>{f.n}<small>{f.a} {f.u} · {fmt(f.v[0])} kcal</small></div><span className="mu">›</span></div>)}
      </>) : (<>
        <div className="row" style={{ marginBottom: 12 }}><b>{food.n}</b>{!edit && <button className="x" onClick={() => setFood(null)}>Change</button>}</div>
        <div className="g2">
          <div><label>QUANTITY</label><input autoFocus type="number" inputMode="decimal" min="0" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></div>
          <div><label>UNIT</label><select value={unit} onChange={(e) => setUnit(e.target.value)}><option value="">{food.u} (base)</option>{units.filter((u) => u.u !== food.u).map((u) => <option key={u.u}>{u.u}</option>)}</select></div>
        </div>
        <div style={{ marginTop: 12 }}><label>MEAL</label><select value={m} onChange={(e) => setM(e.target.value)}>{MEALS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="pv">{[0, 1, 2, 3].map((i) => <div key={i}><b style={{ color: colorOf(K[i][0]) }}>{c.ok ? fmt(c.v[i]) : "–"}</b>{K[i][1]}</div>)}</div>
        <button className="btn" disabled={!c.ok} style={{ opacity: c.ok ? 1 : .4 }} onClick={() => { onAdd(edit ? { ...edit, meal: m, qty: +qty, unit } : { id: uid(), meal: m, food: food.n, qty: +qty, unit }); onClose(); }}>{edit ? "Save changes" : "Add entry"}</button>
      </>)}
    </Sheet>
  );
}

function summary(S, rows, t, bm) {
  const tg = S.targets, line = (v) => `Protein ${fmt(v[1])} g, Carbs ${fmt(v[2])} g, Fat ${fmt(v[3])} g, Fiber ${fmt(v[4])} g`;
  const out = ["My day of eating", "", `Total: ${fmt(t[0])} of ${fmt(tg.cal)} kcal`, line(t), `Cholesterol ${fmt(t[16])} mg`, ""];
  MEALS.forEach((m) => {
    const it = rows.filter(({ r }) => r.meal === m);
    out.push(`${m}: ${fmt(bm[m][0])} kcal`);
    if (!it.length) out.push("  Nothing logged");
    else { out.push("  " + line(bm[m])); it.forEach(({ r, c }) => out.push(`  - ${r.food}, ${r.qty} ${r.unit || c.base || ""}${c.ok ? `, ${fmt(c.v[0])} kcal` : ""}`)); }
    out.push("");
  });
  return out.join("\n").trim();
}

function Today({ S, upd }) {
  const [add, setAdd] = useState(null), [ed, setEd] = useState(null), [ask, setAsk] = useState(false), [toast, setToast] = useState("");
  const log = S.log;
  const t = Array(K.length).fill(0), bm = {};
  MEALS.forEach((m) => (bm[m] = Array(5).fill(0)));
  const rows = log.map((r) => ({ r, c: calc(S, r) }));
  rows.forEach(({ r, c }) => { if (c.ok) { c.v.forEach((x, i) => (t[i] += x)); for (let i = 0; i < 5; i++) bm[r.meal][i] += c.v[i]; } });
  const tg = S.targets, left = tg.cal - t[0];
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const share = async () => {
    const text = summary(S, rows, t, bm);
    try { if (navigator.share) { await navigator.share({ title: "My day of eating", text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); flash("Summary copied to clipboard"); } catch { flash("Couldn’t share on this device"); }
  };
  return (<>
    <div className="date">
      <b>Today</b>
      <div className="row" style={{ gap: 8 }}>
        <button className="pill" disabled={!log.length} onClick={share}>Share</button>
        <button className="pill" disabled={!log.length} onClick={() => setAsk(true)}>Clear day</button>
      </div>
    </div>
    <div className="tgrid"><div className="tcol">
    <div className="card" style={{ textAlign: "center" }}>
      <Ring value={t[0]} target={tg.cal} />
      <div className="mu">{left >= 0 ? `${fmt(left)} kcal left` : `Over by ${fmt(-left)} kcal`}</div>
    </div>
    <div className="macros">
      {[1, 2, 3].map((i) => { const [k, n] = K[i], col = colorOf(k); return (
        <div className="mc" key={k}><span className="mu" style={{ color: col }}>{n}</span><b><Count v={t[i]} /><span className="mu"> g</span></b>
          <Bar p={tg[k] > 0 ? t[i] / tg[k] : 0} color={col} /><div className="mu" style={{ marginTop: 6 }}>of {fmt(tg[k])} g</div></div>); })}
    </div>
    <div className="card">
      <h2>Micronutrients</h2>
      {K.slice(4).map(([k, n, u], i) => { const p = tg[k] > 0 ? t[i + 4] / tg[k] : 0; return (
        <div className="mic" key={k}><span>{n}{LIM[k] ? <span className="mu"> ↓</span> : ""}</span>
          <Bar p={p} color={colorOf(k)} warn={LIM[k] && p > 1} /><span>{fmt(t[i + 4])} / {fmt(tg[k])} {u}</span></div>); })}
    </div>
    </div><div className="tcol">
    {MEALS.map((m) => (
      <div className="card" key={m}>
        <div className="row"><h2 style={{ margin: 0 }}>{m}</h2><div className="row"><b>{fmt(bm[m][0])} <span className="mu">kcal</span></b><button className="add" aria-label={`Add to ${m}`} onClick={() => setAdd(m)}>+</button></div></div>
        <div className="mm">{[1, 2, 3, 4].map((i) => <div key={i}><b style={{ color: colorOf(K[i][0]) }}>{fmt(bm[m][i])}<span> g</span></b>{K[i][1]}</div>)}</div>
        {rows.filter(({ r }) => r.meal === m).map(({ r, c }) => (
          <div className="entry" key={r.id}>
            <div><div>{r.food}</div><small>{r.qty} {r.unit || c.base || ""}{c.ok ? <> · <span style={{ color: colorOf("pro") }}>P {fmt(c.v[1])}</span> <span style={{ color: colorOf("carb") }}>C {fmt(c.v[2])}</span> <span style={{ color: colorOf("fat") }}>F {fmt(c.v[3])}</span> <span style={{ color: colorOf("fib") }}>Fb {fmt(c.v[4])}</span></> : " · can’t convert"}</small></div>
            <div className="row" style={{ gap: 2 }}><b>{c.ok ? fmt(c.v[0]) : "–"}</b><button className="x" aria-label="Edit quantity" onClick={() => setEd(r)}>✎</button><button className="x" aria-label="Remove" onClick={() => upd((s) => { s.log = s.log.filter((e) => e.id !== r.id); })}>✕</button></div>
          </div>))}
      </div>))}
    </div></div>
    {add && <AddEntry S={S} meal={add} onClose={() => setAdd(null)} onAdd={(e) => upd((s) => { s.log.push(e); })} />}
    {ed && <AddEntry S={S} edit={ed} meal={ed.meal} onClose={() => setEd(null)} onAdd={(e) => upd((s) => { s.log = s.log.map((x) => (x.id === e.id ? e : x)); })} />}
    <AD.Root open={ask} onOpenChange={setAsk}>
      <AD.Portal>
        <AD.Overlay className="ovl" />
        <AD.Content className="dlg">
          <AD.Title>Clear today’s log?</AD.Title>
          <AD.Description>This removes every meal and food you’ve tracked today. It can’t be undone.</AD.Description>
          <div className="g2">
            <AD.Cancel className="btn s">Keep it</AD.Cancel>
            <AD.Action className="btn d2" onClick={() => { upd((s) => { s.log = []; }); flash("Day cleared"); }}>Clear all</AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
    {toast && <div className="toast" role="status">{toast}</div>}
  </>);
}

function FoodEditor({ S, idx, upd, onClose }) {
  const nu = idx < 0;
  const [f, setF] = useState(nu ? { n: "", a: 100, u: "g", v: Array(K.length).fill(0), s: "" } : JSON.parse(JSON.stringify(S.foods[idx])));
  const [err, setErr] = useState("");
  const setV = (i, x) => setF({ ...f, v: f.v.map((y, j) => (j === i ? x : y)) });
  const save = () => {
    const n = f.n.trim(), a = parseFloat(f.a), o = { ...f, n, a, v: f.v.map((x) => parseFloat(x) || 0) };
    if (!n || !(a > 0)) return setErr("Name and a reference amount above 0 are required.");
    if (S.foods.some((x, i) => x.n.toLowerCase() === n.toLowerCase() && i !== idx)) return setErr("Food names must be unique.");
    upd((s) => { if (nu) s.foods.push(o); else { const old = s.foods[idx].n; s.log.forEach((e) => { if (e.food === old) e.food = n; }); s.foods[idx] = o; } });
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h2>{nu ? "New food" : "Edit food"}</h2>
      <label>NAME</label><input value={f.n} onChange={(e) => setF({ ...f, n: e.target.value })} />
      <div className="g2" style={{ marginTop: 10 }}>
        <div><label>REFERENCE AMOUNT</label><input type="number" inputMode="decimal" value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} /></div>
        <div><label>UNIT</label><select value={f.u} onChange={(e) => setF({ ...f, u: e.target.value })}>{S.units.map((u) => <option key={u.u}>{u.u}</option>)}</select></div>
      </div>
      <p className="mu">Nutrition for the reference amount. Blank counts as 0.</p>
      <div className="g3">{K.map(([k, n, u], i) => <div key={k}><label style={{ color: colorOf(k) }}>{n.toUpperCase()} ({u})</label><input type="number" inputMode="decimal" value={f.v[i]} onChange={(e) => setV(i, e.target.value)} /></div>)}</div>
      <div style={{ marginTop: 10 }}><label>SOURCE / NOTE</label><input value={f.s} onChange={(e) => setF({ ...f, s: e.target.value })} /></div>
      {err && <p style={{ color: "#f87171" }}>{err}</p>}
      <button className="btn" onClick={save}>{nu ? "Add food" : "Save changes"}</button>
      {!nu && <button className="btn s d" onClick={() => { upd((s) => { s.foods.splice(idx, 1); }); onClose(); }}>Delete food</button>}
    </Sheet>
  );
}

function Foods({ S, upd }) {
  const [q, setQ] = useState(""), [ed, setEd] = useState(null);
  return (<>
    <div className="row sticky"><input placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} /><button className="add" style={{ width: 44, height: 44, flex: "none", borderRadius: 14 }} onClick={() => setEd(-1)}>+</button></div>
    <div className="card fl">
      {S.foods.map((f, i) => f.n.toLowerCase().includes(q.toLowerCase()) && (
        <div className="item food-item" key={f.n} onClick={() => setEd(i)}>
          <div className="food-info"><div className="food-name">{f.n}</div><small>per {f.a} {f.u}{f.s ? " · " + f.s : ""}</small></div>
          <div className="food-nutrition"><div><b>{fmt(f.v[0])}</b> kcal</div>
            <div className="food-macros"><span style={{ color: colorOf("pro") }}>{fmt(f.v[1])}</span> <span style={{ color: colorOf("carb") }}>{fmt(f.v[2])}</span> <span style={{ color: colorOf("fat") }}>{fmt(f.v[3])}</span></div></div>
        </div>))}
    </div>
    {ed !== null && <FoodEditor S={S} idx={ed} upd={upd} onClose={() => setEd(null)} />}
  </>);
}

function Settings({ S, upd, setS }) {
  const file = useRef();
  const exportData = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = `nutrition-backup.json`; a.click(); };
  const importData = (e) => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (d.foods && (d.log || d.days)) setS(migrate(d, FOODS)); } catch {} }; if (e.target.files[0]) r.readAsText(e.target.files[0]); };
  return (<div className="sgrid">
    <div className="card" style={{ gridColumn: "1 / -1" }}><h2>Daily targets</h2>
      <div className="g3">{K.map(([k, n, u]) => <div key={k}><label style={{ color: colorOf(k) }}>{n.toUpperCase()} ({u}){LIM[k] ? " · LIMIT" : ""}</label>
        <input type="number" inputMode="decimal" value={S.targets[k]} onChange={(e) => upd((s) => { s.targets[k] = e.target.value === "" ? 0 : parseFloat(e.target.value); })} /></div>)}</div></div>
    <div className="card"><h2>Unit conversion</h2>
      <p className="mu">Same-group units convert by factor (relative to 1 g / 1 ml). g and ml are treated as equal — approximate for dense foods, so add a per-tablespoon food for accuracy. Count units only match themselves.</p>
      {S.units.map((u, i) => <div className="g3" style={{ gridTemplateColumns: "1fr 1fr 80px 36px", marginBottom: 8 }} key={i}>
        <input value={u.u} onChange={(e) => upd((s) => { s.units[i].u = e.target.value; })} />
        <input value={u.g} onChange={(e) => upd((s) => { s.units[i].g = e.target.value; })} />
        <input type="number" value={u.f} onChange={(e) => upd((s) => { s.units[i].f = parseFloat(e.target.value) || 0; })} />
        <button className="x" onClick={() => upd((s) => { s.units.splice(i, 1); })}>✕</button></div>)}
      <button className="btn s" onClick={() => upd((s) => { s.units.push({ u: "unit", g: "metric", f: 1 }); })}>+ Add unit</button></div>
    <div className="card"><h2>Your data</h2>
      <p className="mu">Everything is stored on this device only. Export a backup now and then — clearing browser data removes it.</p>
      <button className="btn s" onClick={exportData}>Export backup</button>
      <button className="btn s" onClick={() => file.current.click()}>Import backup</button>
      <input ref={file} type="file" accept="application/json" hidden onChange={importData} /></div>
  </div>);
}

export default function App() {
  const [S, setS] = useState(null), [tab, setTab] = useState("today");
  useEffect(() => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(STORE)); } catch {}
    setS(migrate(s, FOODS));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => { if (S) try { localStorage.setItem(STORE, JSON.stringify(S)); } catch {} }, [S]);
  if (!S) return <div className="splash" />;
  const upd = (fn) => setS((p) => { const n = structuredClone(p); fn(n); return n; });
  return (
    <div className="app">
      {tab === "today" && <Today S={S} upd={upd} />}
      {tab === "foods" && <Foods S={S} upd={upd} />}
      {tab === "settings" && <Settings S={S} upd={upd} setS={setS} />}
      <footer className="by">Developed by <a href="https://instagram.com/Aariz4ever" target="_blank" rel="noopener noreferrer"><img src="/instagram-grey.png" alt="Instagram" width="14" height="14" />Aariz4ever</a></footer>
      <nav className="nav">{[["today", "Today"], ["foods", "Foods"], ["settings", "Settings"]].map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</nav>
    </div>
  );
}
