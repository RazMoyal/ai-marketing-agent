import axios from "axios";

const WA_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_ID = process.env.META_WHATSAPP_PHONE_ID;

export async function sendWhatsApp(to: string, message: string) {
  if (!WA_TOKEN || !PHONE_ID) {
    return { status: "mocked", detail: "WhatsApp API not configured" };
  }
  const url = `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: message }
  };
  const res = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" }
  });
  return res.data;
}
