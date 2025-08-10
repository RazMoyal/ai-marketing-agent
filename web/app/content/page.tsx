"use client";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useState } from "react";

export default function ContentPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("professional");
  const [out, setOut] = useState<any>();

  async function gen(e:any) {
    e.preventDefault();
    const res = await API.post("/content/generate", { prompt, style, hashtags: true });
    setOut(res.data);
  }

  return (
    <div>
      <Nav />
      <form onSubmit={gen} className="bg-neutral-900 p-4 rounded flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <div className="text-sm opacity-80">פרומט</div>
          <input className="w-full p-2 rounded bg-neutral-800" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="תאר את הפוסט הרצוי..." />
        </div>
        <div>
          <div className="text-sm opacity-80">סגנון</div>
          <select className="p-2 rounded bg-neutral-800" value={style} onChange={e=>setStyle(e.target.value)}>
            <option value="professional">מקצועי</option>
            <option value="funny">מצחיק</option>
            <option value="romantic">רומנטי</option>
            <option value="dramatic">דרמטי</option>
          </select>
        </div>
        <button className="bg-white text-black px-4 py-2 rounded">צור</button>
      </form>

      {out && (
        <div className="bg-neutral-900 p-4 rounded mt-4 space-y-2">
          <div className="font-semibold">תוצר:</div>
          <div className="whitespace-pre-wrap">{out.text}</div>
          {out.hashtags && <div className="opacity-80 text-sm">#{out.hashtags.join(" #")}</div>}
        </div>
      )}
    </div>
  );
}
