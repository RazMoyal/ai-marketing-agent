
"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

type Post = { id:string, text:string, scheduledAt?:string, status:string, platforms:string[] };

export default function CalendarPage() {
  const [items, setItems] = useState<Post[]>([]);
  const [dragId, setDragId] = useState<string|undefined>();

  async function load() {
    const res = await API.get("/posts");
    setItems(res.data.items);
  }
  useEffect(()=>{ load(); },[]);

  const days = Array.from({length:7}).map((_,i)=> {
    const d = new Date(); d.setDate(d.getDate()-d.getDay()+i+1); d.setHours(9,0,0,0); return d;
  });

  function slotsFor(day: Date) {
    return Array.from({length: 10}).map((_,i)=> {
      const d = new Date(day.getTime() + i*60*60*1000);
      return d;
    });
  }

  function onDragStart(id: string) { setDragId(id); }
  async function onDrop(day: Date, hour: Date) {
    if (!dragId) return;
    const t = hour.toISOString();
    await API.post("/publish", { text: items.find(x=>x.id===dragId)?.text || "", platforms: ["instagram"], scheduledAt: t }); // duplicate scheduling
    setDragId(undefined);
    await load();
  }

  const scheduled = items.filter(p=>p.status==="scheduled");

  return (
    <div>
      <Nav />
      <div className="grid grid-cols-7 gap-2">
        {days.map((d,di)=> (
          <div key={di} className="bg-neutral-900 p-2 rounded">
            <div className="font-semibold text-sm mb-2">{d.toLocaleDateString()}</div>
            {slotsFor(d).map((h,hi)=> (
              <div key={hi}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>onDrop(d,h)}
                className="h-16 border border-neutral-800 rounded mb-1 text-xs p-1">
                {h.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}
                <div className="space-y-1">
                  {scheduled.filter(p=> p.scheduledAt && new Date(p.scheduledAt).getDate()===h.getDate() && new Date(p.scheduledAt).getHours()===h.getHours()).map(p=> (
                    <div key={p.id} draggable onDragStart={()=>onDragStart(p.id)} className="bg-green-700 rounded px-1 py-0.5 truncate">{p.text.slice(0,30)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
