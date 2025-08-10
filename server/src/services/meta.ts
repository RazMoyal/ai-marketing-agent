
import axios from "axios";

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

export async function getInstagramFeedMock(userId: string) {
  return Array.from({length: 9}).map((_, i) => ({
    id: `ig_${i}`,
    mediaUrl: `https://picsum.photos/seed/ig${i}/600/600`,
    caption: `פוסט אינסטגרם #${i+1}`,
    likes: Math.floor(Math.random()*500),
    comments: Math.floor(Math.random()*50),
    timestamp: new Date(Date.now()-i*86400000).toISOString()
  }));
}

export async function getTikTokFeedMock(userId: string) {
  return Array.from({length: 9}).map((_, i) => ({
    id: `tt_${i}`,
    videoThumb: `https://picsum.photos/seed/tt${i}/600/800`,
    caption: `טיקטוק 🔥 #${i+1}`,
    likes: Math.floor(Math.random()*1000),
    comments: Math.floor(Math.random()*80),
    timestamp: new Date(Date.now()-i*43200000).toISOString()
  }));
}

// "Boost" a post via Meta Marketing API (placeholder)
export async function boostPost(options: { postId: string; budget: number; audience?: any }) {
  if (!META_ACCESS_TOKEN) {
    return { status: "queued_local", detail: "No META_ACCESS_TOKEN; stored locally." };
  }
  return { status: "sent_to_meta", adId: `ad_${Math.random().toString(36).slice(2,10)}` };
}

// ---- New: resources & refresh helpers ----
export async function metaListResources(userAccessToken: string) {
  // pages
  const pagesRes = await axios.get("https://graph.facebook.com/v20.0/me/accounts", {
    params: { access_token: userAccessToken, fields: "id,name,access_token,instagram_business_account" }
  });
  const pages = pagesRes.data.data || [];

  // ad accounts
  const adRes = await axios.get("https://graph.facebook.com/v20.0/me/adaccounts", {
    params: { access_token: userAccessToken, fields: "id,account_status,name" }
  });
  const adAccounts = adRes.data.data || [];

  // ig business accounts derived from pages
  const igAccounts = pages
    .map((p: any) => (p.instagram_business_account ? { id: p.instagram_business_account.id, page_id: p.id } : null))
    .filter(Boolean);

  return { pages, adAccounts, igAccounts };
}

export async function metaRefreshLongLived(userAccessToken: string, appId: string, appSecret: string) {
  // try to refresh long-lived user token (re-exchange)
  try {
    const res = await axios.get("https://graph.facebook.com/v20.0/oauth/access_token", {
      params: {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: userAccessToken
      }
    });
    return res.data?.access_token || userAccessToken;
  } catch (e) {
    return userAccessToken;
  }
}


export async function metaListBusinesses(userAccessToken: string) {
  const res = await axios.get("https://graph.facebook.com/v20.0/me/businesses", {
    params: { access_token: userAccessToken, fields: "id,name" }
  });
  return res.data?.data || [];
}

export async function metaBusinessAdAccounts(userAccessToken: string, businessId: string) {
  const res = await axios.get(`https://graph.facebook.com/v20.0/${businessId}/adaccounts`, {
    params: { access_token: userAccessToken, fields: "id,account_status,name" }
  });
  return res.data?.data || [];
}
