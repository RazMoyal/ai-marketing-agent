"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>();
  const [ig, setIg] = useState<any[]>([]);
  const [tt, setTt] = useState<any[]>([]);

  useEffect(()=>{
    (async()=>{
      const s = await API.get("/dashboard/summary"); setSummary(s.data);
      const ig = await API.get("/feed/instagram"); setIg(ig.data.items);
      const tt = await API.get("/feed/tiktok"); setTt(tt.data.items);
    })();
  },[]);

  return (
    <div>
      <Nav />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="צפיות" value={summary?.stats?.views} />
        <StatCard title="לייקים" value={summary?.stats?.likes} />
        <StatCard title="תגובות" value={summary?.stats?.comments} />
        <StatCard title="שיתופים" value={summary?.stats?.shares} />
      </div>

      <h2 className="mt-8 mb-2 text-xl font-semibold">פיד אינסטגרם</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ig.map((p) => (
          <div key={p.id} className="bg-neutral-900 rounded overflow-hidden">
            <Image src={p.mediaUrl} alt="" width={600} height={600}/>
            <div className="p-2 text-sm opacity-80">{p.caption}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-2 text-xl font-semibold">פיד טיקטוק</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tt.map((p) => (
          <div key={p.id} className="bg-neutral-900 rounded overflow-hidden">
            <Image src={p.videoThumb} alt="" width={600} height={800}/>
            <div className="p-2 text-sm opacity-80">{p.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string, value: any }) {
  return (
    <div className="bg-neutral-900 p-4 rounded">
      <div className="opacity-80 text-sm">{title}</div>
      <div className="text-2xl font-bold">{value ?? "—"}</div>
    </div>
  );
}
