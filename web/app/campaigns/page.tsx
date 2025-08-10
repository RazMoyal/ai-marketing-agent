"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

export default function CampaignsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [budget, setBudget] = useState(50);
  const [templates, setTemplates] = useState<any[]>([]);
  const [template, setTemplate] = useState<string>("");

  async function load() {
    const res = await API.get("/campaigns"); setItems(res.data.items);
  }
  useEffect(()=>{ load(); (async()=>{ const t = await API.get('/campaigns/templates'); setTemplates(t.data.templates); })(); },[]);

  async function create(e:any) {
    e.preventDefault();
    await API.post("/campaigns", { name, platform, budget, objective: "reach" });
    setName(""); setBudget(50); await load();
  }

  async function boost(id: string) {
    await API.post(`/campaigns/${id}/boost`, { postId: "ig_1", budget });
    alert("בקשת מימון נשלחה");
  }

  return (
    <div>
      <Nav />
      <form onSubmit={create} className="bg-neutral-900 p-4 rounded flex flex-wrap gap-2 items-end">
        <div>
          <div className="text-sm opacity-80">תבנית</div>
          <select className="p-2 rounded bg-neutral-800" value={template} onChange={e=>{
            const id=e.target.value; setTemplate(id); const t = templates.find((x:any)=>x.id===id);
            if (t){ setPlatform(t.platform); setBudget(t.budget); if(!name) setName(t.name);} }}>
            <option value="">—</option>
            {templates.map((t:any)=>(<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
        <div>
          <div className="text-sm opacity-80">שם קמפיין</div>
          <input className="p-2 rounded bg-neutral-800" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <div className="text-sm opacity-80">פלטפורמה</div>
          <select className="p-2 rounded bg-neutral-800" value={platform} onChange={e=>setPlatform(e.target.value)}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div>
          <div className="text-sm opacity-80">תקציב</div>
          <input type="number" className="p-2 rounded bg-neutral-800 w-32" value={budget} onChange={e=>setBudget(Number(e.target.value))} />
        </div>
        <button className="bg-white text-black px-4 py-2 rounded">צור</button>
      </form>

      <div className="mt-4 grid md:grid-cols-2 gap-3">
        {items.map((c)=> (
          <div key={c.id} className="bg-neutral-900 p-4 rounded">
            <div className="font-semibold">{c.name}</div>
            <div className="opacity-80 text-sm">{c.platform} · ₪{c.budget}</div>
            <button onClick={()=>boost(c.id)} className="mt-2 px-3 py-1 rounded bg-green-600">ממן פוסט</button>
          </div>
        ))}
      </div>
    </div>
  );
}
