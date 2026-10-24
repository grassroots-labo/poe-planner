"use strict";
// Compact factual examples, not copies of manufacturer documents.
const fixtures={
  ap:{url:"https://network.yamaha.com/products/wireless_lan/wlx322/spec",title:"WLX322 仕様",contentType:"text/html",capturedAt:"2026-10-24T00:00:00Z",lines:["モデル名 : WLX322","最大消費電力 : 16W","PoE受電規格 : IEEE802.3at","LANポート : 100BASE-TX / 1000BASE-T / 2.5GBASE-T","802.3afでは無線通信不可"]},
  switch:{url:"https://example.invalid/switch-spec",title:"Fixture PoE switch",contentType:"text/html",capturedAt:"2026-10-24T00:00:00Z",lines:["PoE対応規格 : IEEE802.3af/at","スイッチ最大消費電力 : 89W","PoE給電総電力 : 55W","1ポートあたり最大給電電力 : 30W","PoEポート数 : 8","PoEポート速度 : 10/100/1000Mbps","アップリンク : 10GBASE-T"]},
  injector:{url:"https://www.tp-link.com/in/business-networking/omada-accessory-poe-adapter/tl-poe160s/",title:"TL-POE160S",contentType:"text/html",capturedAt:"2026-10-24T00:00:00Z",lines:["IEEE802.3af/at compliant","Ports : 1 10/100/1000Mbps RJ45 data-in port","Ports : 1 10/100/1000Mbps RJ45 power+data-out port","Power Consumption : Input: 100-240 V, 50/60 Hz Output: max. 30 W"]}
};
if(typeof module!=="undefined")module.exports=fixtures;
