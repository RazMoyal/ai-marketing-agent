# Server (Express + Prisma)

## פקודות
```bash
npm i
npx prisma generate
npx prisma migrate dev --name init
npm run dev
# optional:
npm run seed
```

## ENV
ראו `.env.example`. חשובים:
- `DATABASE_URL` – SQLite ברירת מחדל.
- `JWT_SECRET` – החליפו למפתח חזק.
- `OPENAI_API_KEY` – לתוכן AI אמיתי.
- `META_*` כולל WhatsApp (Cloud API).
- `TIKTOK_*`
- `GOOGLE_*`, `FACEBOOK_*` – OAuth (קיים קוד, יופעל עם מפתחות).

## אבטחה
זהו בסיס מצוין. בפרודקשן מומלץ להוסיף rate limit, אימיילים אמיתיים, OAuth מלא, ועוד.
