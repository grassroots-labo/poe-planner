"use strict";
(()=>{
  const $=id=>document.getElementById(id), core=POE_MASTER_CORE, importer=POE_IMPORTER;
  const storage=core.adapter(), state={records:[],draft:null,busy:false,allowSameSource:false,available:false,failedSource:""};
  const names={ap:"AP・受電機器",switch:"PoEスイッチ",injector:"PoEインジェクタ"};
  const labels={standard:"必要PoE規格",standards:"給電対応規格",pd:"PD消費電力",pse:"PSE必要量",poeClass:"PoEクラス",perPort:"1出力ポートPSE上限",budget:"全体PSE予算",ports:"給電出力ポート数",speeds:"接続ポートの速度",powerMode:"給電方式",uplink:"上流・データ入力"};
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const status=text=>$("master-status").textContent=text;
  const error=text=>{$("master-error").hidden=!text;$("master-error").textContent=text||"";};
  function link(url,title){const a=el("a",title||url);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;}
  function toAp(r){return{...r,sources:[],saved:true,note:`保存データ（本人確認 ${r.confirmedAt.slice(0,10)}）。${r.note} ${r.warnings.join(" / ")}`};}
  function toPse(r){const single=r.kind==="injector"&&r.ports===1&&r.budget===null&&r.perPort!==null;return{...r,budget:single?r.perPort:r.budget,sources:[],saved:true,note:`保存データ（本人確認 ${r.confirmedAt.slice(0,10)}）。${single?"1出力のため、その出力上限を全体PSE予算にも使用。":""}${r.note} ${r.warnings.join(" / ")}`,uplink:r.uplink||"未確認"};}
  rootExpose();
  function rootExpose(){globalThis.POE_MASTERS={getAps:()=>state.records.filter(r=>r.kind==="ap").map(toAp),getPses:()=>state.records.filter(r=>r.kind!=="ap").map(toPse)};}
  function changed(){renderList();document.dispatchEvent(new Event("poe-masters-changed"));}
  async function load(){try{state.records=await storage.read();state.available=true;changed();status(globalThis.chrome?.storage?.local?"保存マスターはこのChromeプロファイル内だけで保持します。":"通常ページのプレビューです。保存はこのブラウザのサイト領域に限られます。ページ取込は拡張で利用してください。");}catch(e){status("保存データを読み込めません。自動上書きは行いません。"+e.message);}}
  function renderList(){
    $("master-count").textContent=String(state.records.length);const list=$("master-list");list.replaceChildren();
    if(!state.records.length)list.append(el("p","保存済みデータはありません。","hint"));
    for(const r of state.records){const card=el("div",undefined,"result-card");card.append(el("h3",`${r.name}（${names[r.kind]}）`));card.append(el("p",`取得：${r.source.capturedAt} / 本人確認：${r.confirmedAt.slice(0,10)}`,"hint"));if(r.source.url)card.append(link(r.source.url,"出典を開く"));else card.append(el("p","出典未登録（手入力）","hint"));const actions=el("div",undefined,"master-actions");const edit=el("button","確認・修正");edit.type="button";edit.addEventListener("click",()=>showDraft(structuredClone(r),true));const remove=el("button","削除");remove.type="button";remove.addEventListener("click",()=>{actions.replaceChildren(el("span","この保存データを削除しますか？"));const yes=el("button","削除する"),no=el("button","キャンセル");yes.type=no.type="button";yes.addEventListener("click",async()=>{if(state.busy)return;state.busy=true;try{const latest=await storage.read();const remaining=latest.filter(v=>v.id!==r.id);await storage.write(remaining);state.records=remaining;changed();status("保存データを削除しました。");}catch(e){status("削除できませんでした。"+e.message);}finally{state.busy=false;}});no.addEventListener("click",renderList);actions.append(yes,no);});actions.append(edit,remove);card.append(actions);list.append(card);}
  }
  function evidence(draft){
    const box=$("master-evidence");box.replaceChildren();
    box.append(el("p","元ページの文言を候補の根拠として示します。編集した値は本人の確認値として保存します。","hint"));
    if(draft.source?.extractedFrom&&draft.source.extractedFrom!==draft.source.url)box.append(link(draft.source.extractedFrom,"抽出した元ページ"));
    const relevant=draft.kind==="ap"?["standard","pd","pse","poeClass","speeds"]:["powerMode","standards","perPort","budget","ports","speeds","uplink"];
    for(const key of relevant){const p=el("p");p.append(el("strong",labels[key]+"："),document.createTextNode((draft.editedFields?.includes(key)?"保存値は手修正。元の抽出根拠：":"")+(draft.evidence?.[key]||"抽出できませんでした。未確認のまま保存するか、元仕様で確認して入力してください。")));box.append(p);}
    for(const note of draft.warnings||[])box.append(el("p",note,"note"));
  }
  function showDraft(draft,editing=false){
    if(state.busy)return;
    state.draft=draft;state.allowSameSource=false;$("master-form").hidden=false;$("master-form-title").textContent=editing?"保存マスターの確認・更新":"取込候補の確認";$("master-duplicates").hidden=true;error("");
    const values={"m-name":draft.name||"","m-url":draft.source?.url||"","m-date":draft.source?.capturedAt||new Date().toISOString(),"m-standard":draft.standard||"","m-pd":draft.pd??"","m-pse":draft.pse??"","m-class":draft.poeClass??"","m-pse-evidence":draft.pseEvidence||"","m-mode":draft.powerMode||"unknown","m-per-port":draft.perPort??"","m-budget":draft.budget??"","m-ports":draft.ports??"","m-speeds":draft.speeds?.join(",")||"","m-uplink":draft.uplink||"","m-note":draft.note||""};
    for(const [id,value]of Object.entries(values))$(id).value=value;
    for(const c of document.querySelectorAll('[name="m-standards"]'))c.checked=Boolean(draft.standards?.includes(c.value));
    for(const item of $("master-form").querySelectorAll("[data-for]"))item.hidden=item.dataset.for==="ap"?draft.kind!=="ap":draft.kind==="ap";
    evidence(draft);$("master-form").scrollIntoView({block:"start",behavior:"smooth"});
  }
  function readDraft(){
    const d=state.draft;const n=id=>$(id).value.trim()===""?null:Number($(id).value);
    const out={...d,name:$("m-name").value,source:{...d.source,url:$("m-url").value,capturedAt:$("m-date").value},standard:$("m-standard").value||null,pd:n("m-pd"),pse:n("m-pse"),poeClass:n("m-class"),pseEvidence:$("m-pse-evidence").value,powerMode:$("m-mode").value,standards:[...document.querySelectorAll('[name="m-standards"]:checked')].map(c=>c.value),perPort:n("m-per-port"),budget:n("m-budget"),ports:n("m-ports"),speeds:$("m-speeds").value,uplink:$("m-uplink").value,note:$("m-note").value};
    const edited=new Set(d.editedFields||[]);for(const key of Object.keys(labels)){const v=key==="speeds"?(out.speeds.trim()?out.speeds.split(",").map(Number):null):out[key];if(JSON.stringify(v)!==JSON.stringify(d[key]??(key==="standards"?[]:null)))edited.add(key);}if(out.name!==d.name)edited.add("name");if(out.source.url!==d.source?.url)edited.add("source");out.editedFields=[...edited];return out;
  }
  async function save(replaceId){
    if(state.busy||!state.draft)return;state.busy=true;$("master-save").disabled=true;error("");
    try{
      if(!state.available)throw Error("保存領域が利用できません。既存データ保護のため保存を停止しています。");
      const draft=readDraft();const normalized=core.normalize(draft);
      if(draft.kind==="ap"){
        const validation=POE_ENGINE.validate({switch:{standards:[],perPort:null,budget:null,ports:null,speeds:null},rows:[{...normalized,qty:1}],allocation:"unknown",margin:0,otherPorts:0,otherPse:0,targetSpeed:null});
        if(validation.length)throw Error(validation.join(" "));
      }
      const latest=await storage.read();const outcome=core.put(latest,normalized,{replaceId,allowSameSource:state.allowSameSource});
      if(outcome.duplicates){
        const box=$("master-duplicates");box.hidden=false;box.replaceChildren(el("p","同じ種類・モデル名、または出典URLの保存データがあります。自動上書きはしません。"));
        for(const r of outcome.duplicates){const b=el("button",`${r.name} を更新`);b.type="button";b.addEventListener("click",()=>save(r.id));box.append(b);}
        const separate=el("button","別の型番名に変えて新規保存");separate.type="button";separate.addEventListener("click",()=>{state.allowSameSource=true;box.hidden=true;$("m-name").focus();status("別の型番名に変更してから保存してください。同じ型番名は重複保存しません。");});box.append(separate);return;
      }
      await storage.write(outcome.records);state.records=outcome.records;state.draft=null;$("master-form").hidden=true;changed();$("saved-masters").open=true;status(outcome.updated?"保存マスターを更新しました。計算の選択肢にも反映しました。":"確認したマスターをローカル保存しました。計算の選択肢から利用できます。");
    }catch(e){error(e.message||"保存できませんでした。");}finally{state.busy=false;$("master-save").disabled=false;}
  }
  $("master-form").addEventListener("submit",e=>{e.preventDefault();save();});
  $("master-cancel").addEventListener("click",()=>{if(state.busy)return;state.draft=null;$("master-form").hidden=true;error("");status("キャンセルしました。保存データは変更していません。");});
  $("master-manual").addEventListener("click",()=>showDraft({kind:$("import-kind").value,name:"",standard:null,standards:[],speeds:null,source:{url:state.failedSource,capturedAt:new Date().toISOString()},evidence:{},warnings:[],note:"手入力。仕様の未確認項目は空欄です。"}));
  $("import-page").addEventListener("click",async()=>{
    if(state.busy)return;state.busy=true;$("import-page").disabled=true;status("選択したタブの仕様候補をローカルで読み取っています…");
    try{
      if(!globalThis.chrome?.scripting)throw Error("通常ページのプレビューではページ取り込みできません。拡張で開くか手入力を利用してください。");
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(!tab?.id)throw Error("対象タブが見つかりません。");
      state.failedSource=importer.safeUrl(tab.url)||"";
      if(tab.url&&!/^https?:\/\//i.test(tab.url))throw Error("http/httpsのHTML仕様ページが対象です。PDF・画像・Chrome内部ページは手入力してください。");
      const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:POE_IMPORTER.readPage});
      const snapshot=results.find(v=>v.frameId===0)?.result;if(!snapshot)throw Error("本文を取得できませんでした。");
      const draft=importer.extract(snapshot,$("import-kind").value);state.failedSource="";state.busy=false;showDraft(draft);status("候補を読み取りました。元仕様と照合・修正し、確認して保存してください。まだ保存していません。");
    }catch(e){status("取り込めませんでした。対象仕様ページで拡張のツールバーボタンを押し直してください。PDF・画像・特殊な表は手入力へ進めます。 "+(e.message||""));}
    finally{state.busy=false;$("import-page").disabled=false;}
  });
  if(globalThis.chrome?.storage?.onChanged)chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes[core.KEY]&&!state.busy)load();});
  load();
})();
