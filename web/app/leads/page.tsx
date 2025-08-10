"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

export default function LeadsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name:"", email:"", phone:"", source:"" });

  async function load() {
    const res = await API.get("/leads", { params: { q } }); setItems(res.data.items);
  }
  useEffect(()=>{ load(); },[]);

  async function add(e:any) {
    e.preventDefault();
    await API.post("/leads", form);
    setForm({ name:"", email:"", phone:"", source:"" });
    await load();
  }

  return (
    <div>
      <Nav />
      <div className="flex gap-2 mb-3">
        <input className="p-2 rounded bg-neutral-900 flex-1" placeholder="חיפוש" value={q} onChange={e=>setQ(e.target.value)} />
        <button onClick={load} className="px-3 py-1 rounded bg-white text-black">חפש</button>
      </div>

      <form onSubmit={add} className="bg-neutral-900 p-3 rounded flex flex-wrap gap-2 items-end">
        {["name","email","phone","source"].map((k)=> (
          <input key={k} className="p-2 rounded bg-neutral-800" placeholder={k} value={(form as any)[k]} onChange={e=>setForm({...form, [k]:e.target.value})} />
        ))}
        <button className="px-3 py-1 rounded bg-green-600">הוסף ליד</button>
      </form>

      <div className="mt-4 bg-neutral-900 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="opacity-70">
            <tr><th className="p-2">שם</th><th>טלפון</th><th>אימייל</th><th>מקור</th><th>נוצר</th></tr>
          </thead>
        <tbody>
          {items.map((l:any)=>(
            <tr key={l.id} className="border-t border-neutral-800">
              <td className="p-2">{l.name}</td>
              <td className="p-2">{l.phone}</td>
              <td className="p-2">{l.email}</td>
              <td className="p-2">{l.source}</td>
              <td className="p-2">{new Date(l.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
