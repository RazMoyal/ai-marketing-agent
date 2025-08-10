
export function appendUtm(url?: string|null, utm?: {utmSource?:string, utmMedium?:string, utmCampaign?:string, utmTerm?:string, utmContent?:string}) {
  if (!url) return url || undefined;
  try {
    const u = new URL(url);
    if (utm?.utmSource) u.searchParams.set("utm_source", utm.utmSource);
    if (utm?.utmMedium) u.searchParams.set("utm_medium", utm.utmMedium);
    if (utm?.utmCampaign) u.searchParams.set("utm_campaign", utm.utmCampaign);
    if (utm?.utmTerm) u.searchParams.set("utm_term", utm.utmTerm);
    if (utm?.utmContent) u.searchParams.set("utm_content", utm.utmContent);
    return u.toString();
  } catch {
    return url;
  }
}
