"use strict";
(function(root){
  const kinds=["ap","switch","injector"];
  const clean=s=>String(s??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").trim();
  const safeUrl=value=>{try{const u=new URL(value);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null;u.hash="";return u.href;}catch{return null;}};
  const negative=s=>/非対応|対応しない|対応していません|not\s+(?:support|compl)|no\s+(?:poe|support)|unsupported/i.test(s);
  function standards(line){
    if(negative(line))return [];
    const out=[];
    if(/802\s*\.\s*3\s*af\b|802\s*\.\s*3\s*at\s*\/\s*af\b/i.test(line))out.push("af");
    if(/802\s*\.\s*3\s*(?:af\s*[/,・]\s*)?at\b/i.test(line))out.push("at");
    if(/802\s*\.\s*3\s*bt\b/i.test(line)){
      if(/type\s*3|タイプ\s*3/i.test(line))out.push("bt3");
      if(/type\s*4|タイプ\s*4/i.test(line))out.push("bt4");
    }
    return out;
  }
  function speedValues(line){
    const found=new Set();
    // Explicit rates only. An advertised 10G port does not imply 2.5G/5G.
    for(const m of line.matchAll(/\b(100|1000)\s*BASE[-\s]?TX?\b/gi))found.add(Number(m[1])/1000);
    for(const m of line.matchAll(/\b(1|2\.5|5|10)\s*G\s*BASE[-\s]?T\b/gi))found.add(Number(m[1]));
    const lists=[...line.matchAll(/((?:\d+(?:\.\d+)?\s*\/\s*)+\d+(?:\.\d+)?)\s*(Mbps|Gbps|BASE[-\s]?T)/gi)];
    for(const m of lists)for(const n of m[1].split("/")){const v=Number(n.trim());found.add(/Gbps/i.test(m[2])?v:v/1000);}
    if(!lists.length)for(const m of line.matchAll(/\b(10|100|1000)\s*Mbps\b|\b(1|2\.5|5|10)\s*Gbps\b/gi))found.add(m[1]?Number(m[1])/1000:Number(m[2]));
    if(/\bgigabit\b|ギガビット/i.test(line))found.add(1);
    return [...found].filter(v=>v>0&&v<=1000).sort((a,b)=>a-b);
  }
  function extract(snapshot,kind){
    if(!kinds.includes(kind))throw Error("機器の種類を選んでください。");
    const url=safeUrl(snapshot.url);
    if(!url)throw Error("出典にはhttp/httpsの仕様ページを指定してください。");
    if(!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(snapshot.contentType||"")||/\.pdf(?:$|\?)/i.test(url))throw Error("PDF・画像・このページ形式の自動取り込みには対応していません。出典を参照して手入力してください。");
    const lines=(Array.isArray(snapshot.lines)?snapshot.lines:String(snapshot.text||"").split(/\n/)).slice(0,3000).map(clean).filter(Boolean).map(s=>s.slice(0,1000));
    const record={kind,name:clean(snapshot.title).slice(0,100)||"取り込み機器",standard:null,standards:[],pd:null,pse:null,poeClass:null,perPort:null,budget:null,ports:null,speeds:null,powerMode:kind==="ap"?null:"unknown",uplink:"未確認",note:"取込候補を本人が確認する必要があります。",pseEvidence:"",source:{url,extractedFrom:url,capturedAt:snapshot.capturedAt||new Date().toISOString()},evidence:{},warnings:[]};
    const values={};
    function candidate(key,value,line){if(value===null||value===undefined)return;if(!values[key])values[key]=[];values[key].push({value,line});}
    const watts=s=>{s=s.replace(/\bmax\.\s*/gi,"max ");const found=[...s.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*W\b/gi)].map(m=>Number(m[1]));return found.length===1&&found[0]>0?found[0]:null;};
    for(const line of lines){
      if(/^(?:型番|モデル名|model(?:\s+name)?)\s*[:：\t]/i.test(line)){const n=line.replace(/^[^:：\t]+[:：\t]\s*/,"");if(n)record.name=n.slice(0,100);}
      const std=standards(line);
      if(kind==="ap"){
        if(/(?:最大消費電力|maximum\s+power\s+consumption|max\.?\s*power\s+consumption)/i.test(line)&&!/スイッチ|switch|PSE/i.test(line))candidate("pd",watts(line),line);
        if(/PSE.*(?:必要|割当|required|budget)|(?:必要|割当|required).*PSE/i.test(line))candidate("pse",watts(line),line);
        if(/PoE|給電|受電|電源|802\.3/i.test(line)&&std.length===1&&!/不可|できません|cannot/i.test(line))candidate("standard",std[0],line);
      }else{
        if(/PoE|給電|standard|IEEE/i.test(line)&&std.length)candidate("standards",std,line);
        if(/パッシブ|passive/i.test(line)&&!negative(line)&&!/非パッシブ|non[- ]passive|not\s+passive/i.test(line))candidate("powerMode","passive",line);
        else if(/IEEE\s*802\s*\.\s*3/i.test(line)&&std.length)candidate("powerMode","ieee",line);
        if(kind==="switch"){
          if(/(?:PoE|給電).*(?:総|合計|全体|budget|total)|(?:total|budget).*(?:PoE|power\s+budget)/i.test(line)&&!/消費電力|consumption/i.test(line))candidate("budget",watts(line),line);
          if(/(?:1\s*ポート|ポートあたり|per\s*port|each\s*port).*(?:給電|PoE|W)|(?:PoE|給電).*(?:per\s*port|1\s*ポート|ポートあたり)/i.test(line)&&!/消費電力|consumption/i.test(line))candidate("perPort",watts(line),line);
          let m=line.match(/(?:PoE\+?\s*(?:給電)?\s*ポート数|給電ポート数|PoE\+?\s*ports?)\s*[:：\t]?\s*(\d+)\b/i)||line.match(/\b(\d+)\s*PoE\+?\s*(?:ポート|ports?)\b/i);
          if(m)candidate("ports",Number(m[1]),line);
        }else{
          const output=line.match(/(?:出力(?:電力)?|output)\s*[:：]?\s*(.+)/i);
          if(output)candidate("perPort",watts(output[1]),line);
          const m=line.match(/(?:給電出力ポート数|PoE出力ポート数)\s*[:：\t]?\s*(\d+)\b/i)||line.match(/\b(\d+)\s+(?:10\/100\/1000Mbps\s+)?RJ45\s+power\+data[- ]out\s+ports?/i);
          if(m)candidate("ports",Number(m[1]),line);
        }
      }
      if(/(?:PoE\s*)?(?:class|クラス)\s*[:：]?\s*[0-8]\b/i.test(line)&&kind==="ap"){const m=line.match(/(?:class|クラス)\s*[:：]?\s*([0-8])\b/i);candidate("poeClass",Number(m[1]),line);}
      const speedContext=kind==="ap"?/LAN\s*ポート|Ethernet\s*port|有線ポート/i:/PoE.*(?:ポート|ports?)|power\+data[- ]out|data\s*(?:rate|speed)|データ速度|対応速度/i;
      if(speedContext.test(line)&&!/uplink|アップリンク|SFP/i.test(line)){const speeds=speedValues(line);if(speeds.length)candidate("speeds",speeds,line);}
      if(kind!=="ap"&&/uplink|アップリンク|SFP/i.test(line)){record.uplink=line.slice(0,300);record.evidence.uplink=line;}
      if(/不可|できません|制限|restriction|not\s+support|passive|パッシブ/i.test(line)&&/PoE|802\.3|無線|給電|passive|パッシブ/i.test(line))record.warnings.push(line);
    }
    for(const [key,items] of Object.entries(values)){
      const unique=[...new Map(items.map(x=>[JSON.stringify(x.value),x])).values()];
      if(key==="standards"){
        const all=[...new Set(items.flatMap(x=>x.value))];record.standards=all;record.evidence[key]=items.map(x=>x.line).slice(0,4).join("\n");
      }else if(key==="powerMode"&&items.some(x=>x.value==="passive")){
        record.powerMode="passive";record.standards=[];record.evidence[key]=items.filter(x=>x.value==="passive").map(x=>x.line).join("\n");record.warnings.push("パッシブPoEの記載があります。IEEE PoEとして合格にしません。給電方式を確認してください。");
      }else if(unique.length===1){record[key]=unique[0].value;record.evidence[key]=unique[0].line;}
      else {record.evidence[key]="候補が競合：\n"+unique.map(x=>x.line).slice(0,5).join("\n");record.warnings.push(`${key}に複数の異なる候補があります。値は未確認にしています。`);}
    }
    if(record.powerMode==="passive")record.standards=[];
    if(record.pse!==null)record.pseEvidence=record.evidence.pse;
    if(snapshot.truncated)record.warnings.push("ページが長いため読み取り範囲を制限しました。元ページで不足がないか確認してください。");
    record.warnings=[...new Set(record.warnings)].slice(0,12);
    return record;
  }
  // Serialized by chrome.scripting. It is deliberately self-contained.
  function readPage(){
    const contentType=document.contentType||"";
    if(!/^(text\/html|application\/xhtml\+xml)/i.test(contentType))return {url:location.href,title:document.title,contentType,lines:[]};
    const rows=Array.from(document.querySelectorAll("table tr")).slice(0,1500).map(row=>Array.from(row.querySelectorAll("th,td")).map(c=>(c.innerText||"").trim()).filter(Boolean).join(" : ")).filter(Boolean);
    const body=(document.body?.innerText||"");
    const text=body.slice(0,100000);
    return {url:location.href,title:document.title,contentType,lines:[...rows,...text.split(/\n/)].slice(0,3000),capturedAt:new Date().toISOString(),truncated:body.length>100000||rows.length>=1500};
  }
  const api={extract,readPage,safeUrl,standards,speedValues,clean};
  if(typeof module!=="undefined")module.exports=api;root.POE_IMPORTER=api;
})(globalThis);
