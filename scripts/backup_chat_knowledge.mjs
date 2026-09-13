import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const url = new URL(process.env.SUPABASE_URL);
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Falta SUPABASE_SECRET_KEY");
const headers = {apikey:key, ...(key.startsWith("eyJ") ? {Authorization:`Bearer ${key}`} : {})};
const rows = [];
for (let offset=0;;offset+=500) {
  const response = await fetch(`${url.origin}/rest/v1/rag_documents?select=*&order=id&offset=${offset}&limit=500`,{headers,signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`No se puede exportar: HTTP ${response.status}`);
  const batch = await response.json();
  rows.push(...batch);
  if (batch.length<500) break;
}
if (!rows.length) throw new Error("No hay documentos; no se crea una copia vacía");
const dir = path.resolve(".cache/chat-backups",new Date().toISOString().replace(/[:.]/g,"-"));
fs.mkdirSync(dir,{recursive:true});
const data = JSON.stringify(rows);
fs.writeFileSync(path.join(dir,"rag_documents.json"),data);
fs.copyFileSync("supabase/rag-schema.sql",path.join(dir,"rag-schema.sql"));
fs.cpSync("content/kb",path.join(dir,"kb"),{recursive:true});
fs.writeFileSync(path.join(dir,"manifest.json"),JSON.stringify({version:1,sourceProject:url.hostname,createdAt:new Date().toISOString(),rows:rows.length,sha256:crypto.createHash("sha256").update(data).digest("hex"),includes:["rag_documents (including embeddings)","schema SQL","source corpus"],excludes:["credentials","chat counters","account settings"]},null,2));
console.log(JSON.stringify({backup:dir,rows:rows.length,verified:JSON.parse(fs.readFileSync(path.join(dir,"rag_documents.json"))).length===rows.length}));
