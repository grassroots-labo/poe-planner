"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
function server() { return http.createServer((req,res)=>{
  let p;
  try { p=decodeURIComponent(new URL(req.url,"http://localhost").pathname); } catch { res.writeHead(400);res.end();return; }
  const file=path.resolve(root,"."+ (p==="/" ? "/extension/sidepanel.html" : p));
  if (!file.startsWith(root+path.sep)) { res.writeHead(403);res.end();return; }
  fs.readFile(file,(err,buf)=>{ if(err){res.writeHead(404);res.end("Not found");return;} res.setHeader("Content-Type",({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"})[path.extname(file)]||"application/octet-stream");res.setHeader("Cache-Control","no-store");res.end(buf); });
}); }
if(require.main===module) server().listen(8765,"127.0.0.1",()=>console.log("Local preview: http://127.0.0.1:8765 (Ctrl+C to stop)"));
module.exports=server;
