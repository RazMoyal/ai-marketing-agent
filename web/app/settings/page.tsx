
"use client";
import React from "react";
import Nav from "@/components/Nav";
import API from "@/lib/api";
import { useEffect, useState } from "react";

type MetaResources = {
  pages: Array<{id:string,name:string,access_token?:string,instagram_business_account?:{id:string}}>;
  adAccounts: Array<{id:string,name?:string}>;
  igAccounts: Array<{id:string,page_id:string}>;
};

export default function SettingsPage() {
  const [user, setUser] = useState<any>();
  const [name, setName] = useState("");
  const [tz, setTz] = useState("Asia/Jerusalem");
  const [locale, setLocale] = useState("he");
  const [connections, setConnections] = useState<any[]>([]);

  // Meta resource selection state
  const [metaRes, setMetaRes] = useState<MetaResources|undefined>();
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [selectedAd, setSelectedAd] = useState<string>("");
  const [selectedIg, setSelectedIg] = useState<string>("");
  const [metaMsg, setMetaMsg] = useState<string>("");

  useEffect(()=>{
    (async()=>{
      const me = await API.get("/me"); setUser(me.data.user);
      setName(me.data.user?.name || ""); setTz(me.data.user?.tz || "Asia/Jerusalem"); setLocale(me.data.user?.locale || "he");
      await refreshConnections();
    })();
  },[]);

  async function refreshConnections() {
    const st = await API.get("/integrations/status");
    setConnections(st.data.connections);
  }

  async function save() {
    const me = await API.put("/me", { name, tz, locale }); setUser(me.data.user);
  }

  async function connectOAuth(provider: string) {
    const res = await API.get(`/auth/oauth/${provider}/start`);
    const { url } = res.data; window.location.href = url;
  }

  async function toggle(platform: string) {
    const found = connections.find(c => c.platform === platform);
    if (found) {
      await API.post(`/integrations/${platform}/disconnect`);
    } else {
      if (platform === "instagram" || platform === "facebook" || platform === "tiktok") {
        await connectOAuth(platform === "facebook" || platform === "instagram" ? "meta" : "tiktok");
        return;
      }
      await API.post(`/integrations/${platform}/connect`, { accessToken: "server-managed" });
    }
    await refreshConnections();
  }

  function connected(p: string) { return connections.some((c)=>c.platform===p); }

  async function loadMetaResources() {
    setMetaMsg("");
    try {
      const res = await API.get("/integrations/meta/resources");
      setMetaRes(res.data);
      // preselect if existing in connection meta
      const fb = connections.find(c => c.platform === "facebook");
      const ig = connections.find(c => c.platform === "instagram");
      if (fb?.meta?.page_id) setSelectedPage(fb.meta.page_id);
      if (fb?.meta?.ad_account_id) setSelectedAd(fb.meta.ad_account_id);
      if (ig?.meta?.ig_business_account_id) setSelectedIg(ig.meta.ig_business_account_id);
    } catch (e: any) {
      setMetaMsg(e?.response?.data?.error || "שגיאה בטעינת משאבי Meta");
    }
  }

  async function saveMetaSelection() {
    setMetaMsg("");
    try {
      await API.post("/integrations/meta/select", {
        page_id: selectedPage || undefined,
        ad_account_id: selectedAd || undefined,
        ig_business_account_id: selectedIg || undefined
      });
      setMetaMsg("נשמר בהצלחה");
      await refreshConnections();
    } catch (e: any) {
      setMetaMsg(e?.response?.data?.error || "שמירה נכשלה");
    }
  }

  return (
    <div>
      <Nav />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 p-4 rounded">
          <h2 className="font-semibold mb-3">פרופיל</h2>
          <div className="space-y-2">
            <input className="w-full p-2 rounded bg-neutral-800" placeholder="שם" value={name} onChange={e=>setName(e.target.value)} />
            <input className="w-full p-2 rounded bg-neutral-800" placeholder="אזור זמן" value={tz} onChange={e=>setTz(e.target.value)} />
            <input className="w-full p-2 rounded bg-neutral-800" placeholder="שפה" value={locale} onChange={e=>setLocale(e.target.value)} />
            <button onClick={save} className="bg-white text-black px-4 py-2 rounded">שמור</button>
          </div>
        </div>

        <div className="bg-neutral-900 p-4 rounded">
          <h2 className="font-semibold mb-3">חיבורים</h2>
          {["instagram","tiktok","facebook","whatsapp"].map((p)=> (
            <div key={p} className="flex items-center justify-between py-2 border-b border-neutral-800">
              <div className="capitalize">{p}</div>
              <button onClick={()=>toggle(p)} className={"px-3 py-1 rounded " + (connected(p) ? "bg-green-600" : "bg-neutral-800")}>
                {connected(p) ? "מחובר" : "חבר"}
              </button>
            </div>
          ))}
          <div className="text-xs opacity-70 mt-2">
            שים לב: WhatsApp Cloud API מנוהל ע״י מפתחות שרת.
          </div>

          {/* Meta resource selection */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">הגדרות Meta (עמוד/IG/חשבון מודעות)</h3>
              <button onClick={loadMetaResources} className="px-3 py-1 rounded bg-neutral-800">טען</button>
            </div>
            {metaMsg && <div className="text-sm mt-2">{metaMsg}</div>}
            {metaRes && (
              <div className="space-y-2 mt-3">
                <div>
                  <div className="text-sm opacity-80">Page</div>
                  <select className="p-2 rounded bg-neutral-800 w-full" value={selectedPage} onChange={e=>setSelectedPage(e.target.value)}>
                    <option value="">—</option>
                    {metaRes.pages.map(p => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm opacity-80">Instagram Business</div>
                  <select className="p-2 rounded bg-neutral-800 w-full" value={selectedIg} onChange={e=>setSelectedIg(e.target.value)}>
                    <option value="">—</option>
                    {metaRes.igAccounts.map(p => <option key={p.id} value={p.id}>{p.id} (page {p.page_id})</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm opacity-80">Ad Account</div>
                  <select className="p-2 rounded bg-neutral-800 w-full" value={selectedAd} onChange={e=>setSelectedAd(e.target.value)}>
                    <option value="">—</option>
                    {metaRes.adAccounts.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
                  </select>
                </div>
                <button onClick={saveMetaSelection} className="px-3 py-1 rounded bg-white text-black">שמור בחירה</button>
              </div>
            )}
          </div>
        
          {/* Meta Business Manager selection */}
          <div className="mt-6">
            <BusinessSelector />
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessSelector() {
  const [businesses, setBusinesses] = React.useState<any[]>([]);
  const [adAccounts, setAdAccounts] = React.useState<any[]>([]);
  const [biz, setBiz] = React.useState<string>("");
  const [ad, setAd] = React.useState<string>("");
  const [msg, setMsg] = React.useState<string>("");

  async function loadBusinesses() {
    setMsg("");
    try {
      const res = await API.get("/integrations/meta/businesses");
      setBusinesses(res.data.businesses);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "שגיאה בטעינת עסקים");
    }
  }
  async function pickBiz(id: string) {
    setBiz(id); setAdAccounts([]); setAd("");
    if (!id) return;
    try {
      const res = await API.get(`/integrations/meta/businesses/${id}/adaccounts`);
      setAdAccounts(res.data.adAccounts);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "שגיאה בטעינת חשבונות מודעות");
    }
  }
  async function save() {
    setMsg("");
    try {
      await API.post("/integrations/meta/selectBusiness", { business_id: biz || undefined, ad_account_id: ad || undefined });
      setMsg("נשמר");
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "שמירה נכשלה");
    }
  }

  return (
    <div className="bg-neutral-900 p-4 rounded">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Business Manager / פרופיל מודעות</h3>
        <button onClick={loadBusinesses} className="px-3 py-1 rounded bg-neutral-800">טען עסקים</button>
      </div>
      {msg && <div className="text-sm mt-2">{msg}</div>}
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <div className="text-sm opacity-80">Business</div>
          <select value={biz} onChange={e=>pickBiz(e.target.value)} className="p-2 rounded bg-neutral-800 w-full">
            <option value="">—</option>
            {businesses.map((b:any)=>(<option key={b.id} value={b.id}>{b.name} ({b.id})</option>))}
          </select>
        </div>
        <div>
          <div className="text-sm opacity-80">Ad Account</div>
          <select value={ad} onChange={e=>setAd(e.target.value)} className="p-2 rounded bg-neutral-800 w-full">
            <option value="">—</option>
            {adAccounts.map((a:any)=>(<option key={a.id} value={a.id}>{a.name || a.id} ({a.id})</option>))}
          </select>
        </div>
      </div>
      <button onClick={save} className="mt-3 px-3 py-1 rounded bg-white text-black">שמור</button>
    </div>
  );
}
