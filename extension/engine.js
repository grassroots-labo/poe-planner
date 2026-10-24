"use strict";
(function (root) {
  const caps = { af: 15.4, at: 30, bt3: 60, bt4: 90 };
  const pdCaps = { af: 12.95, at: 25.5, bt3: 51, bt4: 73 };
  const classPower = { 0: 15.4, 1: 4, 2: 7, 3: 15.4, 4: 30, 5: 45, 6: 60, 7: 75, 8: 90 };
  const classPd = { 0: 12.95, 1: 3.84, 2: 6.49, 3: 12.95, 4: 25.5, 5: 40, 6: 51, 7: 62, 8: 73 };
  const finite = v => typeof v === "number" && Number.isFinite(v);
  const unknown = v => v === null || v === undefined || v === "";
  const fmt = n => Number(n.toFixed(3)).toString();
  const result = (status, reason) => ({ status, reason });
  const merge = rs => rs.some(r => r.status === "fail") ? "fail" : rs.some(r => r.status === "check") ? "check" : "pass";
  function validate(x) {
    const errors = [];
    const num = (v, label, max, integer = false, optional = false) => {
      if (optional && unknown(v)) return;
      if (!finite(v) || v < 0 || v > max || (integer && !Number.isInteger(v))) errors.push(`${label}：0〜${max}${integer ? 'の整数' : 'の数値'}で入力してください。`);
    };
    if (!x || !x.switch || !Array.isArray(x.rows)) return ["入力形式が不正です。"];
    if (!x.rows.length || x.rows.length > 50) errors.push("機器を1〜50行入力してください。");
    num(x.margin, "余裕率", 100);
    num(x.otherPorts, "他機器のポート数", 10000, true);
    num(x.otherPse, "他機器のPSE予算", 1000000, false, true);
    if (x.otherPorts === 0 && finite(x.otherPse) && x.otherPse > 0) errors.push("他機器の電力を計上する場合、他機器のポート数も入力してください。");
    if (!["unknown", "standard", "class", "pse"].includes(x.allocation)) errors.push("電力割当方式を選び直してください。");
    const s = x.switch;
    ["budget", "perPort", "ports"].forEach(k => num(s[k], `スイッチ ${k}`, 1000000, k === "ports", true));
    const speeds = (v, label) => { if (v !== null && (!Array.isArray(v) || v.some(n => !finite(n) || n <= 0 || n > 1000))) errors.push(`${label}の速度集合が不正です。`); };
    speeds(s.speeds, "スイッチ");
    if (!Array.isArray(s.standards) || s.standards.some(v => !Object.hasOwn(caps, v))) errors.push("スイッチの規格入力が不正です。");
    num(x.targetSpeed, "希望リンク速度", 1000, false, true);
    if (x.targetSpeed === 0) errors.push("希望リンク速度は0より大きい値にしてください。");
    x.rows.forEach((r, i) => {
      const label = `機器${i + 1}`;
      num(r.qty, `${label} 台数`, 10000, true);
      if (r.qty === 0) errors.push(`${label} 台数は1以上にしてください。不要な行は削除できます。`);
      num(r.pd, `${label} PD消費電力`, 10000, false, true);
      num(r.pse, `${label} PSE必要電力`, 10000, false, true);
      if (!unknown(r.pd) && r.pd === 0) errors.push(`${label} PD消費電力は0より大きい値にしてください。`);
      if (!unknown(r.pse) && r.pse === 0) errors.push(`${label} PSE必要電力は0より大きい値にしてください。`);
      if (!unknown(r.pse) && !unknown(r.pd) && r.pse < r.pd) errors.push(`${label} PSE必要電力はPD消費電力以上である必要があります。`);
      if (!unknown(r.standard) && !Object.hasOwn(caps, r.standard)) errors.push(`${label} 規格が不正です。`);
      if (pdCaps[r.standard] && finite(r.pd) && r.pd > pdCaps[r.standard]) errors.push(`${label} PD消費電力が選択規格の最大受電電力を超えています。規格と電力の意味を再確認してください。`);
      if (!unknown(r.poeClass) && (!Number.isInteger(r.poeClass) || r.poeClass < 0 || r.poeClass > 8)) errors.push(`${label} PoEクラスは0〜8です。`);
      if (!unknown(r.poeClass) && finite(r.pd) && r.pd > classPd[r.poeClass]) errors.push(`${label} PD消費電力が指定クラスの最大受電電力を超えています。`);
      if (!unknown(r.poeClass) && caps[r.standard] && classPower[r.poeClass] > caps[r.standard]) errors.push(`${label} PoEクラスが選択規格の上限を超えています。`);
      if (!unknown(r.poeClass) && ((r.standard === "at" && r.poeClass < 4) || (r.standard === "bt3" && r.poeClass < 5) || (r.standard === "bt4" && r.poeClass < 7))) errors.push(`${label} 必要PoE規格とクラスが整合しません。機能に必要な規格と実際のクラスを確認してください。`);
      if (!unknown(r.pse) && caps[r.standard] && r.pse > caps[r.standard]) errors.push(`${label} PSE必要電力が選択規格の上限を超えています。規格を再確認してください。`);
      speeds(r.speeds, label);
    });
    return errors;
  }
  function evaluate(x) {
    const errors = validate(x);
    if (errors.length) return { errors, powerStatus: "check", speedStatus: "check" };
    const s = x.switch;
    let sum = 0, totalKnown = true;
    const rows = x.rows.map(r => {
      const standard = !r.standard || !s.standards.length ? result("check", "APまたはスイッチの対応規格が不明です。") : s.standards.includes(r.standard) ? result("pass", `${r.name}の必要規格 ${r.standard} をスイッチの対応集合で確認。`) : result("fail", `${r.name}は ${r.standard} が必要。スイッチの対応集合に含まれません。消費電力が小さくても代替できません。`);
      let reserve = null, basis = "PSE側の割当量が未確認。PD消費電力を代入しません。";
      if (x.allocation === "standard" && caps[r.standard]) { reserve = caps[r.standard]; basis = `確認した規格上限予約：${r.standard} のPSE上限 ${fmt(reserve)}W/台（実消費量ではありません）。`; }
      if (x.allocation === "class" && !unknown(r.poeClass)) { reserve = classPower[r.poeClass]; basis = `確認したClass ${r.poeClass} 予約：PSE ${fmt(reserve)}W/台。`; }
      if (x.allocation === "pse" && finite(r.pse) && r.pseEvidence?.trim()) { reserve = r.pse; basis = `PSE側の確認値 ${fmt(reserve)}W/台。根拠：${r.pseEvidence.trim()}`; }
      if (x.allocation === "class" && unknown(r.poeClass)) basis = "PoEクラスが不明です。at対応だけから実機のクラスを確定しません。";
      if (x.allocation === "pse" && (!finite(r.pse) || !r.pseEvidence?.trim())) basis = "PSE側の必要量と根拠メモの両方が必要です。PDの値から推測しません。";
      const required = reserve === null ? null : Math.max(reserve, r.pse || 0);
      let perPort = result("check", basis);
      if (finite(s.perPort)) {
        if ((finite(r.pd) && r.pd > s.perPort) || (finite(r.pse) && r.pse > s.perPort)) perPort = result("fail", `既知の必要電力が1ポート上限 ${fmt(s.perPort)}W を超えます。`);
        else if (required !== null) perPort = result(required <= s.perPort ? "pass" : "fail", `${basis} 判定用 ${fmt(required)}W / 上限 ${fmt(s.perPort)}W。`);
      }
      if (required === null) totalKnown = false; else sum += required * r.qty;
      let speed;
      const common = Array.isArray(r.speeds) && Array.isArray(s.speeds) ? r.speeds.filter(v => s.speeds.includes(v)) : [];
      const link = common.length ? Math.max(...common) : null;
      if (!r.speeds?.length || !s.speeds?.length) speed = result("check", "AP側またはPoEポート側の対応速度集合が未確認です。10G表記から2.5G/5Gを推測しません。");
      else if (link === null) speed = result("check", "登録された対応集合に共通速度がありません。資料の集合が完全か確認してください。");
      else {
        const apMax = Math.max(...r.speeds);
        const msg = `共通速度の上限 ${fmt(link)}Gbps / AP上限 ${fmt(apMax)}Gbps。${link < apMax ? 'PoEポート側がAP有線速度のボトルネック候補。' : 'AP上限まで共通速度あり。'}`;
        speed = unknown(x.targetSpeed) ? result("check", msg + " 希望速度が未設定です。") : result(link >= x.targetSpeed ? "pass" : "fail", msg + ` 希望 ${fmt(x.targetSpeed)}Gbps ${link >= x.targetSpeed ? '以上' : 'に不足'}。`);
      }
      return { name: r.name || "手入力機器", qty: r.qty, standard, perPort, speed, reserve: required, link, basis, note: r.note || "手入力値。機能制限・資料の適用条件を確認してください。" };
    });
    const portsNeeded = x.rows.reduce((a, r) => a + r.qty, 0) + x.otherPorts;
    const ports = !finite(s.ports) ? result("check", "利用可能なPoEポート数が不明です。") : result(portsNeeded <= s.ports ? "pass" : "fail", `必要 ${portsNeeded} / 利用可能 ${s.ports}ポート。${portsNeeded > s.ports ? `${portsNeeded - s.ports}ポート不足。` : ''} 上流に使うPoEポートは利用可能数から除いてください。`);
    if (x.otherPorts > 0 && !finite(x.otherPse)) totalKnown = false;
    const base = sum + (x.otherPorts > 0 ? (x.otherPse || 0) : 0);
    const withMargin = base * (1 + x.margin / 100);
    // Known PD figures are only a lower bound and can prove a shortage, never success.
    const lower = x.rows.reduce((a, r) => a + Math.max(r.pd || 0, r.pse || 0) * r.qty, 0) + (x.otherPorts > 0 ? (x.otherPse || 0) : 0);
    let budget = result("check", `PSE側の割当量が未確認です。既知分 ${fmt(base)}W、PD等による下限 ${fmt(lower)}W。全台分の割当量を確定してください。`);
    if (!finite(s.budget)) budget = result("check", "スイッチ全体のPSE予算が不明です。");
    else if (lower > s.budget) budget = result("fail", `既知の下限だけで ${fmt(lower)}W > 全体 ${fmt(s.budget)}W。少なくとも ${fmt(lower - s.budget)}W不足。`);
    else if (totalKnown) budget = result(base <= s.budget ? "pass" : "fail", `PSE割当合計 ${fmt(base)}W / 全体 ${fmt(s.budget)}W。${base > s.budget ? `${fmt(base - s.budget)}W不足。` : `残り ${fmt(s.budget - base)}W。`} 任意の余裕率を含みません。`);
    const margin = !totalKnown || !finite(s.budget) ? result("check", "基本のPSE割当量が不明のため余裕率を評価できません。") : result(withMargin <= s.budget ? "pass" : "fail", `任意の余裕率 ${fmt(x.margin)}%：${fmt(base)} × ${fmt(1 + x.margin / 100)} = ${fmt(withMargin)}W / ${fmt(s.budget)}W。規格要件とは別の設計条件です。`);
    const other = x.otherPorts === 0 ? result("pass", "他機器なしとして計算。使用中の機器があれば必ず入力してください。") : result(x.otherVerified && finite(x.otherPse) ? "pass" : "check", `他機器 ${x.otherPorts}ポート / PSE ${finite(x.otherPse) ? fmt(x.otherPse) + 'W' : '不明'}。${x.otherVerified ? '規格・1ポート・割当量の確認済み申告あり。' : '他機器の規格・1ポート・割当量は別途確認が必要。個別の機器行での入力も可能。'}`);
    return { errors: [], rows, ports, budget, margin, other, totalKnown, base, withMargin, lower,
      powerStatus: merge([...rows.flatMap(r => [r.standard, r.perPort]), ports, budget, other]),
      speedStatus: merge(rows.map(r => r.speed)) };
  }
  const engine = { evaluate, validate, caps, classPower, merge };
  if (typeof module !== "undefined") module.exports = engine;
  root.POE_ENGINE = engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
