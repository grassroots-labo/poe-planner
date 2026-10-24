"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const data = globalThis.POE_DATA;
  const engine = globalThis.POE_ENGINE;
  const value = el => el.value.trim() === "" ? null : Number(el.value);
  const number = id => value($(id));
  const speedSet = text => text.trim() === "" ? null : text.split(",").map(s => s.trim() === "" ? NaN : Number(s));
  const element = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const badge = status => element("span", {pass:"満たす",fail:"不足",check:"要確認"}[status], "badge " + (status === "check" ? "check-status" : status));
  const line = (label, r) => { const e = element("div", undefined, "check-line"); e.append(badge(r.status), element("strong", label), element("p", r.reason)); return e; };
  function sources(container, ids) {
    for (const id of ids) { const s = data.sources[id]; const p = element("p"); const a = element("a", s.title); a.href = s.url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.append(a, element("br"), document.createTextNode(`公式資料確認日：${s.checked}`)); container.append(p); }
  }
  function fillDevice(card) {
    const get = k => card.querySelector(`[data-key="${k}"]`);
    const ap = data.aps.find(a => a.id === get("model").value);
    for (const key of ["name","pd","standard","speeds"]) {
      get(key).disabled = Boolean(ap);
      get(key).value = ap ? (Array.isArray(ap[key]) ? ap[key].join(",") : ap[key] ?? "") : "";
    }
    for (const key of ["pse","poeClass","pseEvidence"]) get(key).value = "";
    card.querySelector(".device-note").textContent = ap ? ap.note : "手入力値はこの画面でのみ有効です。出典で規格・速度集合・機能制限を確認してください。空欄は不明として扱います。";
  }
  function addDevice() {
    if ($("devices").children.length >= 50) return;
    const card = $("device-template").content.firstElementChild.cloneNode(true);
    card.querySelector('[data-key="model"]').addEventListener("change", () => { fillDevice(card); render(); });
    card.querySelector(".remove").addEventListener("click", () => { card.remove(); render(); });
    $("devices").append(card); fillDevice(card); render();
  }
  function read() {
    const rows = Array.from($("devices").children).map(card => {
      const get = key => card.querySelector(`[data-key="${key}"]`);
      const ap = data.aps.find(a => a.id === get("model").value);
      return { ...(ap || {}), name: get("name").value.trim() || "手入力機器", qty: value(get("qty")), pd: value(get("pd")), standard: get("standard").value || null, speeds: speedSet(get("speeds").value), pse: value(get("pse")), poeClass: value(get("poeClass")), pseEvidence: get("pseEvidence").value };
    });
    const sw = data.switches.find(s => s.id === $("switch").value);
    const custom = !sw;
    $("manual-switch").hidden = !custom;
    const s = sw ? { ...sw } : { name: $("s-name").value.trim() || "手入力スイッチ", standards: $("s-standard").value ? $("s-standard").value.split(",") : [], budget: number("s-budget"), perPort: number("s-port"), ports: number("s-ports"), speeds: speedSet($("s-speeds").value), uplink: $("s-uplink").value.trim() || "未確認", sources: [], note: "手入力値。メーカー資料の電源条件・ポート別上限・適用設定を確認してください。" };
    const reserved = number("reserved");
    const inputErrors = [];
    if (!Number.isInteger(reserved) || reserved < 0 || reserved > 1000000) inputErrors.push("利用できないポート数：0以上の整数で入力してください。");
    else if (s.ports !== null && s.ports !== undefined) {
      if (reserved > s.ports) inputErrors.push("利用できないポート数がPoEポート数を超えています。");
      else s.ports -= reserved;
    }
    return { rows, switch: s, allocation: $("allocation").value, margin: number("margin"), otherPse: number("other-pse"), otherPorts: number("other-ports"), otherVerified: $("other-verified").checked, targetSpeed: number("target"), inputErrors };
  }
  function render() {
    const x = read(); const r = engine.evaluate(x); const errors = [...x.inputErrors, ...r.errors];
    const summary = $("switch-summary"); summary.replaceChildren();
    const sw = x.switch;
    summary.append(element("strong", sw.name), element("p", `1ポート ${sw.perPort ?? '不明'}W · 全体 ${sw.budget ?? '不明'}W · 利用可能 ${sw.ports ?? '不明'} PoEポート`), element("p", `PoEポート確認速度：${sw.speeds?.length ? sw.speeds.join(' / ') + ' Gbps' : '未確認'}`), element("p", `上流アップリンク：${sw.uplink}`), element("p", sw.note));
    const out = $("results"); out.replaceChildren(); const heading = element("h2"); heading.append(element("b", "04"), document.createTextNode(" 判定・根拠")); out.append(heading);
    if (errors.length) {
      const box = element("div", undefined, "error"); box.setAttribute("role","alert"); box.append(element("strong","入力を確認してください。判定を保留しています。")); const ul = element("ul"); errors.forEach(t => ul.append(element("li",t))); box.append(ul); out.append(box); return;
    }
    const overview = element("div", undefined, "overview");
    for (const [label, status] of [["基本の給電条件",r.powerStatus],["希望する有線速度",r.speedStatus]]) { const box = element("div"); box.append(element("p",label),badge(status)); overview.append(box); }
    out.append(overview, element("p", "速度の不足はPoE不足とは別です。「1Gでも許容」に変更して希望条件を比較できます。", "hint"));
    const total = element("div", undefined, "result-card"); total.append(element("h3","スイッチ全体"),line("PSE総予算",r.budget),line("PoEポート数",r.ports),line("他のPoE機器",r.other),line("任意の余裕率（別判定）",r.margin)); out.append(total);
    r.rows.forEach((row,i) => {
      const box = element("div", undefined, "result-card"); box.append(element("h3",`${i + 1}. ${row.name} × ${row.qty}台`),line("PoE規格",row.standard),line("1ポート給電",row.perPort),line("AP接続ポートの速度",row.speed),element("p", row.note, "note"));
      if (x.rows[i].sources) { const d = element("details"); d.append(element("summary","この機器の根拠")); sources(d,x.rows[i].sources); box.append(d); }
      out.append(box);
    });
    out.append(element("p", "通信条件：要確認。ケーブル種別・距離・PoE対応、Ethernet規格、上流側の対応速度・集約帯域、設定は未検証です。表示は確認できた共通速度の上限で、実効速度や総合的な通信互換を保証しません。", "note"));
  }
  for (const sw of data.switches) { const o = element("option",sw.name); o.value=sw.id; $("switch").append(o); }
  const manual=element("option","手入力スイッチ"); manual.value="manual"; $("switch").append(manual);
  sources($("sources"), Object.keys(data.sources));
  $("sources").append(element("p","内蔵データ：AP 1機種、スイッチ2機種。引用資料の対象版・地域・電源条件を使用前に確認してください。型番の末尾やハードウェア版が違う機種に流用しないでください。"));
  $("add").addEventListener("click",addDevice);
  document.addEventListener("input", render);
  document.addEventListener("change", render);
  addDevice();
})();
