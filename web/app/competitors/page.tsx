"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

export default function CompetitorsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [result, setResult] = useState<any>();

  async function load() { const res = await API.get("/competitors"); setItems(res.data.items); }
  useEffect(()=>{ load(); },[]);

  async function add(e:any) {
    e.preventDefault();
    await API.post("/competitors", { platform, handle });
    setHandle(""); await load();
  }

  async function analyze() {
    const res = await API.post("/competitors/analyze"); setResult(res.data);
  }

  return (
    <div>
      <Nav />
      <form onSubmit={add} className="bg-neutral-900 p-4 rounded flex flex-wrap items-end gap-2">
        <select className="p-2 rounded bg-neutral-800" value={platform} onChange={e=>setPlatform(e.target.value)}>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
        </select>
        <input className="p-2 rounded bg-neutral-800" placeholder="handle" value={handle} onChange={e=>setHandle(e.target.value)} />
        <button className="px-3 py-1 rounded bg-white text-black">הוסף</button>
        <button type="button" onClick={analyze} className="px-3 py-1 rounded bg-green-600">נתח</button>
      </form>

      <div className="mt-3 grid md:grid-cols-2 gap-2">
        {items.map((c)=>(
          <div key={c.id} className="bg-neutral-900 p-3 rounded">
            {c.platform} · @{c.handle}
          </div>
        ))}
      </div>

      {result && (
        <div className="bg-neutral-900 p-4 rounded mt-4">
          <div className="font-semibold mb-2">תוצאות ניתוח</div>
          <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
