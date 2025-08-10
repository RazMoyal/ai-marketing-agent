
"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

type Kind = "image" | "video" | "reel" | "carousel";

export default function PublisherPage() {
  const [text, setText] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<Kind>("image");
  const [platforms, setPlatforms] = useState<string[]>(["instagram"]);
  const [mode, setMode] = useState<"now"|"schedule">("now");
  const [when, setWhen] = useState<string>("");
  const [log, setLog] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function uploadFiles() {
    if (files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    files.forEach((f)=> fd.append("files", f));
    const res = await API.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setMediaUrls(res.data.urls || []);
    setUploading(false);
  }

  async function submit(e:any) {
    e.preventDefault();
    const payload: any = { text, platforms, mediaKind: kind };
    if (kind === "carousel") payload.mediaUrls = mediaUrls;
    else payload.mediaUrl = mediaUrls[0];

    if (mode === "schedule" && when) payload.scheduledAt = new Date(when).toISOString();
    const res = await API.post("/publish", payload);
    setLog([res.data, ...log]);
    if (mode === "now") { setText(""); setMediaUrls([]); setFiles([]); }
  }

  function togglePlatform(p: string) {
    setPlatforms((arr) => arr.includes(p) ? arr.filter(x=>x!==p) : [...arr, p]);
  }

  const minDateTimeLocal = () => {
    const d = new Date(Date.now() + 60_000);
    const pad = (n:number)=> String(n).padStart(2,"0");
    const s = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return s;
  };


  function openCloudWidget() {
    // @ts-ignore
    if (typeof window !== "undefined" && (window as any).cloudinary) {
      // @ts-ignore
      const widget = (window as any).cloudinary.createUploadWidget({
        multiple: true
      }, (error:any, result:any) => {
        if (!error && result && result.event === "success") {
          setMediaUrls((arr)=> [...arr, result.info.secure_url || result.info.url]);
        }
      });
      widget.open();
    } else {
      alert("Cloudinary widget לא נטען (צריך להגדיר CLOUDINARY ולהוסיף script).");
    }
  }

  useEffect(()=>{
    // inject cloudinary widget script if not present
    if (typeof window !== "undefined" && !(window as any).cloudinary) {
      const s = document.createElement("script");
      s.src = "https://widget.cloudinary.com/v2.0/global/all.js";
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  return (
    <div>
      <Nav />
      <form onSubmit={submit} className="bg-neutral-900 p-4 rounded space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm opacity-80">טקסט הפוסט</div>
            <textarea className="w-full p-2 rounded bg-neutral-800 min-h-[160px]" value={text} onChange={e=>setText(e.target.value)} placeholder="מה נפרסם?"></textarea>
          </div>
          <div>
            <div className="text-sm opacity-80">סוג התוכן</div>
            <div className="flex flex-wrap gap-2">
              {(["image","video","reel","carousel"] as Kind[]).map(k => (
                <label key={k} className={"px-3 py-1 rounded cursor-pointer " + (kind===k ? "bg-green-600" : "bg-neutral-800")}>
                  <input type="radio" name="kind" className="hidden" checked={kind===k} onChange={()=>setKind(k)} /> {k}
                </label>
              ))}
            </div>
            <div className="mt-3">
              <button type="button" onClick={()=>openCloudWidget()} className="px-2 py-1 rounded bg-neutral-800 mr-2">פתח Cloudinary</button>
              <div className="text-sm opacity-80">קבצים (אפשר לבחור כמה לקרוסלה)</div>
              <input type="file" multiple onChange={(e)=> setFiles(Array.from(e.target.files||[]))} />
              <button type="button" onClick={uploadFiles} disabled={files.length===0 || uploading} className="ml-2 px-2 py-1 rounded bg-neutral-800">
                {uploading ? "מעלה..." : "העלה"}
              </button>
              {mediaUrls.length>0 && (
                <div className="text-xs opacity-80 mt-2">{mediaUrls.length} קבצים הועלו</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {["instagram","facebook","tiktok"].map((p)=> (
            <label key={p} className={"px-3 py-1 rounded cursor-pointer " + (platforms.includes(p) ? "bg-green-600" : "bg-neutral-800")}>
              <input type="checkbox" className="hidden" checked={platforms.includes(p)} onChange={()=>togglePlatform(p)} /> {p}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode==="now"} onChange={()=>setMode("now")} /> מיידי
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode==="schedule"} onChange={()=>setMode("schedule")} /> מתוזמן
          </label>
          {mode==="schedule" && (
            <input type="datetime-local" className="p-2 rounded bg-neutral-800"
              min={minDateTimeLocal()} value={when} onChange={e=>setWhen(e.target.value)} />
          )}
        </div>
        <button className="px-4 py-2 rounded bg-white text-black">פרסם</button>
      </form>


      <ScheduledList />

      {log.length>0 && (
        <div className="bg-neutral-900 p-4 rounded mt-4">
          <div className="font-semibold mb-2">תוצאות אחרונות</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(log, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}


function ScheduledList() {
  const [items, setItems] = useState<any[]>([]);
  async function load() {
    const res = await API.get("/posts"); setItems(res.data.items);
  }
  useEffect(()=>{ load(); const t = setInterval(load, 10000); return ()=>clearInterval(t); },[]);
  const upcoming = items.filter((x:any)=> x.status==="scheduled").sort((a:any,b:any)=> new Date(a.scheduledAt).getTime()-new Date(b.scheduledAt).getTime()).slice(0,20);
  if (upcoming.length===0) return null;
  return (
    <div className="bg-neutral-900 p-4 rounded mt-4">
      <div className="font-semibold mb-2">תזמון קרוב</div>
      <div className="text-sm grid md:grid-cols-2 gap-2">
        {upcoming.map((p:any)=>(
          <div key={p.id} className="border border-neutral-800 rounded p-2">
            <div className="opacity-80">{new Date(p.scheduledAt).toLocaleString()}</div>
            <div className="truncate">{p.text}</div>
            <div className="opacity-70 text-xs">{(p.platforms||[]).join(", ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
