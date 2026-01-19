# KAIYU - Ứng dụng học tiếng Trung

## 🚀 Tech Stack

### Backend (NestJS)
- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma
- **Auth**: JWT + Google OAuth
- **AI**: Google Gemini API

### Frontend (Next.js)
- **Framework**: Next.js 15 + TypeScript
- **Styling**: TailwindCSS
- **State**: React Context + Hooks
- **API**: Axios

## 📦 Cấu trúc dự án

```
KAIYU/
├── backend/          # NestJS API server
├── frontend-nextjs/  # Next.js web app
└── README.md
```

## 🔧 Environment Variables

### Backend (.env)
```env
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GEMINI_API_KEY=your_gemini_api_key
SMTP_USER=your_email
SMTP_PASS=your_app_password
APP_URL=https://your-frontend-domain.vercel.app
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.onrender.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

## 🚀 Deploy

### Backend → Render.com
1. Connect GitHub repo
2. Select `backend` folder
3. Build command: `npm install && npx prisma generate && npm run build`
4. Start command: `npm run start:prod`
5. Add environment variables

### Frontend → Vercel
1. Connect GitHub repo
2. Select `frontend-nextjs` folder
3. Framework: Next.js (auto-detected)
4. Add environment variables

## 👤 Author
KAIYU Team - HocTiengTrung App
