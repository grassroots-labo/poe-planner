"use strict";
(function(root){
  const KEY="poePlannerMastersV1";
  const text=(s,max=1000)=>String(s??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").trim().slice(0,max);
  const optionalNumber=(v,max=1000000,integer=false)=>{if(v===null||v===undefined||v==="")return null;const n=typeof v==="number"?v:Number(v);if(!Number.isFinite(n)||n<=0||n>max||(integer&&!Number.isInteger(n)))throw Error("数値は0より大きい有限の値で入力してください。ポート数は整数です。");return n;};
  function url(value){if(!value)return "";const u=new URL(value);if(!["http:","https:"].includes(u.protocol)||u.username||u.password)throw Error("出典URLは認証情報を含まないhttp/https URLにしてください。");u.hash="";return u.href;}
  function normalize(input){
    if(!input||!["ap","switch","injector"].includes(input.kind))throw Error("機器種別が不正です。");
    const name=text(input.name,100);if(!name)throw Error("モデル名を入力してください。");
    const valid=["af","at","bt3","bt4"];
    const standard=input.standard||null;if(standard!==null&&!valid.includes(standard))throw Error("PoE規格が不正です。");
    const standards=Array.isArray(input.standards)?[...new Set(input.standards)]:[];if(standards.some(s=>!valid.includes(s)))throw Error("対応規格が不正です。");
    let speeds=input.speeds;
    if(typeof speeds==="string")speeds=speeds.trim()?speeds.split(",").map(s=>s.trim()===""?NaN:Number(s.trim())):null;
    if(speeds!==null&&speeds!==undefined&&(!Array.isArray(speeds)||speeds.some(s=>typeof s!=="number"||!Number.isFinite(s)||s<=0||s>1000)))throw Error("速度は明記された値だけをカンマ区切りで入力してください（例：1,2.5）。");
    const poeClass=input.poeClass===null||input.poeClass===undefined||input.poeClass===""?null:Number(input.poeClass);if(poeClass!==null&&(!Number.isInteger(poeClass)||poeClass<0||poeClass>8))throw Error("PoEクラスは0〜8または未確認です。");
    const powerMode=input.powerMode||"unknown";if(!["unknown","ieee","passive"].includes(powerMode))throw Error("給電方式が不正です。");
    const source={url:url(input.source?.url||""),extractedFrom:url(input.source?.extractedFrom||input.source?.url||""),capturedAt:text(input.source?.capturedAt,80)||new Date().toISOString()};
    if(!Number.isFinite(Date.parse(source.capturedAt)))throw Error("取得日が不正です。");
    const evidence={};for(const key of ["standard","standards","pd","pse","poeClass","perPort","budget","ports","speeds","powerMode","uplink"])if(input.evidence?.[key])evidence[key]=text(input.evidence[key],3000);
    const editable=["name","source","standard","standards","pd","pse","poeClass","perPort","budget","ports","speeds","powerMode","uplink"];
    const editedFields=Array.isArray(input.editedFields)?[...new Set(input.editedFields.filter(k=>editable.includes(k)))]:[];
    const r={id:text(input.id,100)||"master-"+crypto.randomUUID(),kind:input.kind,name,standard,standards,pd:optionalNumber(input.pd,10000),pse:optionalNumber(input.pse,10000),poeClass,perPort:optionalNumber(input.perPort,10000),budget:optionalNumber(input.budget),ports:optionalNumber(input.ports,10000,true),speeds:speeds?.length?[...new Set(speeds)].sort((a,b)=>a-b):null,powerMode,source,evidence,editedFields,pseEvidence:text(input.pseEvidence),uplink:text(input.uplink,300)||"未確認",note:text(input.note),warnings:Array.isArray(input.warnings)?input.warnings.slice(0,12).map(v=>text(v,1000)):[],confirmedAt:new Date().toISOString(),reviewed:true};
    if(r.kind==="ap"&&r.pd!==null&&r.pse!==null&&r.pse<r.pd)throw Error("PSE必要量はPD消費電力以上である必要があります。電力の意味を確認してください。");
    if(r.kind!=="ap"&&r.powerMode!=="ieee"&&r.standards.length)throw Error("パッシブまたは方式不明の給電機器にIEEE対応規格を確定できません。規格を未確認にするか給電方式を確認してください。");
    return r;
  }
  const keyName=r=>r.name.normalize("NFKC").replace(/\s+/g,"").toLowerCase();
  function duplicates(records,draft){return records.filter(r=>r.kind===draft.kind&&r.id!==draft.id&&(keyName(r)===keyName(draft)||(r.source?.url&&r.source.url===draft.source?.url)));}
  function put(records,draft,{replaceId,allowSameSource=false}={}){
    const r=normalize(draft);const list=records.slice();const byId=list.findIndex(v=>v.id===r.id);const collision=duplicates(list,r);
    if(byId>=0){if(collision.some(v=>keyName(v)===keyName(r)))throw Error("別の保存データとモデル名が重複しています。名前を区別してください。");list[byId]={...r,id:list[byId].id};return{records:list,record:list[byId],updated:true};}
    if(replaceId){const idx=list.findIndex(v=>v.id===replaceId&&v.kind===r.kind);if(idx<0)throw Error("更新対象が見つかりません。保存データを読み直してください。");list[idx]={...r,id:replaceId};return{records:list,record:list[idx],updated:true};}
    const blocking=allowSameSource?collision.filter(v=>keyName(v)===keyName(r)):collision;
    if(blocking.length)return{duplicates:blocking,records};
    if(list.length>=100)throw Error("保存上限は100機種です。不要なデータを削除してください。");
    list.push(r);return{records:list,record:r,updated:false};
  }
  function validateStored(value){
    if(!Array.isArray(value)||value.length>100)throw Error("保存データの形式が不正です。自動的には上書きしません。");
    const ids=new Set();return value.map(v=>{const r=normalize(v);if(!v.id||ids.has(r.id))throw Error("保存データのIDが不正です。");ids.add(r.id);return{...r,confirmedAt:text(v.confirmedAt,80)||r.confirmedAt};});
  }
  function adapter(){
    if(root.chrome?.storage?.local)return {read:async()=>{const data=await chrome.storage.local.get(KEY);return validateStored(data[KEY]??[]);},write:async records=>{await chrome.storage.local.set({[KEY]:validateStored(records)});}};
    return {read:async()=>validateStored(JSON.parse(localStorage.getItem(KEY)||"[]")),write:async records=>localStorage.setItem(KEY,JSON.stringify(validateStored(records)))};
  }
  const api={KEY,normalize,duplicates,put,validateStored,adapter};if(typeof module!=="undefined")module.exports=api;root.POE_MASTER_CORE=api;
})(globalThis);
