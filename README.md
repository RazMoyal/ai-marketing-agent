# Auto Marketing Agent – Full Stack

מערכת ניהול שיווק דיגיטלי אוטונומית (סוכן AI מלא). מונורפו עם **server/** (Express + Prisma/SQLite) ו-**web/** (Next.js + Tailwind).  
עובד "מהקופסה" עם נתוני דמה; מתחבר ל-APIs אמיתיים כשמגדירים מפתחות.

## התקנה מהירה

```bash
# 1) חלצו משתנים לסביבה לפי הדוגמה
cp server/.env.example server/.env
cp web/.env.example web/.env

# 2) התקנת תלויות
cd server && npm i && npx prisma generate && npx prisma migrate dev --name init && cd ..
cd web && npm i && cd ..

# 3) הרצה בפיתוח (טרמינלים נפרדים)
cd server && npm run dev
cd web && npm run dev
```

- שרת API: `http://localhost:4000`
- פרונט: `http://localhost:3000`
- התחברות דמה: הירשם במערכת (נשמר ב-SQLite).

## תצורה (ENV)

ראו `server/.env.example` ו-`web/.env.example`. שדות עיקריים: JWT_SECRET, OPENAI_API_KEY, META_* (כולל WhatsApp), TIKTOK_*, GOOGLE_*, FACEBOOK_*, SERVER_BASE_URL, CLIENT_BASE_URL.

## מבנה הקוד (קיצור)
```
server/
  src/
    index.ts              # Express + CORS + routes + cron
    prisma/               # Prisma client
    routes/               # REST endpoints
    services/             # Connectors (Meta/TikTok/WhatsApp/OpenAI) + mocks
    lib/                  # jwt, validators
    jobs/                 # AI recommendations
  prisma/schema.prisma

web/
  app/                    # Next.js App Router
  components/             # UI
  lib/                    # api client, auth
  styles/                 # Tailwind
```

## זרימת התחברות
- הרשמה/התחברות בסיסית עם אימייל+סיסמה (bcrypt + JWT).
- OAuth (Google/Facebook): קיים קוד מוכן, יופעל כשמגדירים מפתחות (אחרת יקבלו 501).
- טוקן נשמר ב-LocalStorage בצד לקוח ונשלח ב-Authorization Bearer לכל בקשת API.

## API עיקרי
- `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password` (דמה)
- `GET /me`, `PUT /me`
- `GET /integrations/status`, `POST /integrations/:platform/connect`, `POST /integrations/:platform/disconnect`
- `GET/POST /campaigns`, `POST /campaigns/:id/boost`
- `GET/POST /leads`
- `POST /content/generate`
- `GET/POST /competitors`, `POST /competitors/analyze`
- `GET /dashboard/summary`, `GET /feed/instagram`, `GET /feed/tiktok`
- `POST /webhooks/meta`, `POST /webhooks/whatsapp`

## תכונות
- דשבורד: סטטיסטיקות, פידים, והתראות חכמות (דמה/אמיתי).
- קמפיינים: יצירה/מימון (שולח ל-Meta אם יש מפתחות, אחרת נרשם כ-"בקשת מימון" מקומית).
- מחולל תוכן AI: משתמש ב-OpenAI (אם מוגדר מפתח).
- לידים: שמירה/חיפוש + שליחת WhatsApp (Cloud API) אם מוגדר.
- ניתוח מתחרים: שמירת רשימה, ניתוח דמה/אמיתי דרך קונקטורים.
- RTL מלא, Tailwind, תאימות מובייל.

## הערות פיתוח
- פריסמה: SQLite (`server/prisma/dev.db`). ניתן לשדרג ל-PostgreSQL – החליפו `DATABASE_URL` ו-`provider` בפריסמה והריצו מיגרציה.
- אפשר להריץ Seed בסיסי: `npm run seed` בצד השרת (מכניס דמה).
- קוד נבנה בצורה מודולרית להחלפת קונקטורים בקלות.


## OAuth מתקדם + בחירת משאבים
- Meta: התחברות -> השרת שומר user token (long-lived), טוען Pages / IG Business / Ad Accounts ומאפשר לבחור ב־Settings.
  - `GET /auth/oauth/meta/callback` – החלפת קוד לטוקן + long-lived.
  - `GET /integrations/meta/resources` – שליפת משאבים לחשבון.
  - `POST /integrations/meta/select` – שמירת ברירות מחדל (page/ad/ig) לחיבורים.
- TikTok: התחברות -> שמירת access/refresh token והתרעננות אוטומטית.
- ריענון טוקנים אוטומטי: קרון יומי 03:30. אפשר גם ידני:
  - `POST /integrations/refresh/meta`
  - `POST /integrations/refresh/tiktok`


## פרסום רב-פלטפורמות (מיידי/מתוזמן)
- API:
  - `POST /publish` – גוף: `{ text, mediaUrl?, platforms: ["instagram"|"facebook"|"tiktok"], scheduledAt? }`
    - אם `scheduledAt` בעתיד → נשמר כ-`scheduled` ומפורסם אוטומטית ע״י cron כל דקה.
    - אחרת → מתפרסם מיידית ומוחזר `result` לכל פלטפורמה.
  - `GET /posts` – רשימת פרסומים.
- UI: `/publisher` – בחירת פלטפורמות, מיידי/תזמון, ותצוגת תוצאות.

## Business Manager / פרופיל מודעות
- `GET /integrations/meta/businesses` – רשימת עסקים למשתמש (Meta).
- `GET /integrations/meta/businesses/:id/adaccounts` – חשבונות מודעות של העסק.
- `POST /integrations/meta/selectBusiness` – שמירת business_id ו־ad_account_id ב־facebook connection.
- UI: הגדרות → מקטע Business Manager.


## העלאת קבצים ומדיה
- נקודת קצה: `POST /upload` עם `multipart/form-data` ושדה `files` (עד 10).
- אם מוגדר Cloudinary (`CLOUDINARY_URL` או משתני Cloudinary), הקבצים יועלו לענן והמערכת תחזיר URLs מאובטחים. אחרת נשמרים מקומית תחת `/uploads`.
- עמוד `/publisher` כולל העלאה מרובת קבצים ותמיכה ב־image/video/reel/carousel, פרסום מיידי או מתוזמן, וריבוי פלטפורמות.


## TikTok – Direct Post / Inbox Upload
- וידאו: 
  - Direct Post: `POST https://open.tiktokapis.com/v2/post/publish/video/init/` (דורש scope: `video.publish`).
  - Inbox Upload (טיוטה): `POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/` (scope: `video.upload`), עם `source_info` מסוג `PULL_FROM_URL` או `FILE_UPLOAD`, ואז העלאת וידאו ל-`upload_url` אם FILE_UPLOAD.
- תמונות: `POST https://open.tiktokapis.com/v2/post/publish/content/init/` עם `media_type=PHOTO` ו־`post_mode=MEDIA_UPLOAD` או `DIRECT POST`.
> מומלץ לאמת דומיין/URL Prefix כדי להשתמש ב־PULL_FROM_URL (למשל דומיין Cloudinary שלך).

## Facebook – Photos / Videos / Reels
- Photos: `POST /{page-id}/photos` עם `url` + `caption`.
- Videos: `POST /{page-id}/videos` עם `file_url` + `description`.
- Reels: קיימת תמיכה ב־**Reels Publishing API** (ראו מסמכי Meta). ניתן להרחיב ל־`/{page-id}/video_reels` בזרימת upload resumable (בהמשך).


## תורים, רטריי ופריסה
- BullMQ + Redis מניעים את תורי הפרסום. השרת כולל Worker שמטפל בתורי `publish` (אפשר לפצל לשירות worker ייעודי).
- Docker Compose מצורף (`docker-compose.yml`) עם redis + server + web.
- Sentry (אופציונלי): הגדירו `SENTRY_DSN` כדי לקבל שגיאות ודוחות ביצועים.
- Calendar: עמוד `/calendar` מאפשר צפייה בסטים מתוזמנים וגרירת פריטים לשעה/יום (בגרסה ראשונית).

## מודל ארגונים (Agency Mode)
- הרשמה יוצרת ארגון ברירת מחדל למשתמש ומסמנת אותו כ־currentOrgId.
- חיבורים, פוסטים וקמפיינים נשמרים עם `orgId` (כאשר קיים). בהמשך ניתן להוסיף ממשק ניהול ארגונים/לקוחות.

## Audit Log
- כל פעולה חשובה ניתנת ללוג ב־`AuditLog` (סיוע פונקציית `audit()` – ניתן להרחיב לנקודות קריטיות).


## UTM ברירת מחדל לארגון
- `GET /settings/org` – החזרת פרטי ארגון (כולל שדות UTM).
- `PUT /settings/org/utm` – שמירה של `utm_source/utm_medium/utm_campaign/utm_term/utm_content`.
- הפרסום מוסיף UTM לקישורים/מדיה מבוססי URL באופן אוטומטי.

## Facebook Reels (Resumable)
- פונקציה `fbReelsUploadFromUrl(pageId, accessToken, videoUrl, description?)` שמבצעת start→upload→finish ל־`/{page-id}/video_reels`.
- אם נכשל/לא זמין – נופל ל־Videos API.

## TikTok FILE_UPLOAD
- פונקציות `tiktokUploadVideoToInbox` + `tiktokUploadChunks(uploadUrl, data)` להעלאה ישירה ל־upload_url.
- שמומלץ להשתמש ב־Cloudinary/URL מאומת ל־PULL_FROM_URL ולהימנע משמירת קבצים מקומיים.

## Bull Board
- נגיש בדפדפן ב־`/admin/queues` לצפייה בתורים.

## Healthchecks + Docker
- Dockerfiles multi-stage + בריאות לשירותים.
- `docker compose up --build` מפעיל redis+server+web עם בריאות/תלויות.

## Webhooks
- `POST /webhooks/meta` + `POST /webhooks/tiktok` – קליטה של אירועי Meta/TikTok (כולל verify token ל-Meta).
- יש להגדיר Verify Token (`META_WEBHOOK_VERIFY_TOKEN`) ולמפות כתובות בממשקי המפתחים.
