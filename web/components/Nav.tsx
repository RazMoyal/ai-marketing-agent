"use client";
import Link from "next/link";
import { setToken } from "@/lib/api";

export default function Nav() {
  function logout() { setToken(undefined); window.location.href = "/login"; }
  const links = [
    ["dashboard","דשבורד"],
    ["settings","הגדרות"],
    ["campaigns","קמפיינים"],
    ["content","תוכן AI"],
    ["publisher","פרסום"],
    ["calendar","יומן"],
    ["leads","לידים"],
    ["competitors","מתחרים"],
  ];
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="text-xl font-bold">סוכן שיווק אוטונומי</div>
      <div className="flex gap-4">
        {links.map(([href,label]) => (
          <Link key={href} href={`/${href}`} className="hover:underline">{label}</Link>
        ))}
        <button onClick={logout} className="bg-neutral-800 px-3 py-1 rounded">התנתקות</button>
      </div>
    </div>
  );
}
