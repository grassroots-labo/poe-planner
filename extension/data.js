"use strict";
(function (root) {
  const sources = {
    yamahaSpec: { title: "Yamaha WLX322 仕様 / ハードウェア・インターフェース", url: "https://network.yamaha.com/products/wireless_lan/wlx322/spec", checked: "2026-10-24" },
    yamahaGuide: { title: "Yamaha WLX322/WLX323 ユーザーガイド 10.3 PoE給電規格", url: "https://www.rtpro.yamaha.co.jp/RT/manual/wlx322_wlx323/userguide/10_reference.html", checked: "2026-10-24" },
    netgear: { title: "NETGEAR GS110TPv3 / GS110TPP Installation Guide（2025年11月）p.3,7,8", url: "https://www.downloads.netgear.com/files/GDC/GS110TPP/GS110TPv3_GS110TPP_IG_EN.pdf", checked: "2026-10-24" }
  };
  const aps = [{ id: "wlx322", name: "Yamaha WLX322", standard: "at", pd: 16, pse: null, poeClass: null,
    speeds: [0.1, 1, 2.5], sources: ["yamahaSpec", "yamahaGuide"],
    note: "802.3at必須。802.3afでは起動しても無線通信不可。最大消費電力16WはPSE予算の必要量ではありません。PoEクラスとPSE側必要量は今回の資料で未確認。" }];
  const switches = [
    { id: "gs110tpv3", name: "NETGEAR GS110TPv3", standards: ["af", "at"], perPort: 30, budget: 55, ports: 8, speeds: [1], uplink: "SFP ×2（速度集合は今回未確認）。銅線ポートを上流に使う場合はPoE利用可能ポート数を減らしてください。", sources: ["netgear"] },
    { id: "gs110tpp", name: "NETGEAR GS110TPP", standards: ["af", "at"], perPort: 30, budget: 120, ports: 8, speeds: [1], uplink: "非PoE銅線ポート ×2。Gigabit Ethernet接続。上流機器・集約帯域は別途確認。", sources: ["netgear"] }
  ].map(s => ({ ...s, allocation: "unknown", note: "PoEはポート1→8の順に優先。予算超過時は一部機器への給電が止まる可能性があります。クラス表は確認済みですが、現在の割当設定は未確認。PoEポート速度は資料で確認できた1Gのみ登録（他速度を推測しません）。" }));
  const data = { sources, aps, switches };
  if (typeof module !== "undefined") module.exports = data;
  root.POE_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
