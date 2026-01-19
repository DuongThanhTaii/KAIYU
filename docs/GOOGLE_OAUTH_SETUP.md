# Hướng dẫn Setup Google OAuth

## Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Đặt tên project (ví dụ: `chinese-learning-app`)
4. Click **Create**

## Bước 2: Bật Google+ API

1. Vào **APIs & Services** → **Library**
2. Tìm **Google+ API**
3. Click **Enable**

## Bước 3: Tạo OAuth Credentials

1. Vào **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Nếu chưa configure, click **Configure consent screen**:
   - User Type: **External**
   - App name: `Chinese Learning App`
   - User support email: Email của bạn
   - Developer contact: Email của bạn
   - Click **Save and Continue** (bỏ qua các bước khác)
4. Quay lại **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Name: `Chinese Learning Web Client`
7. **Authorized JavaScript origins**:
   - `http://localhost:5173` (development)
   - `https://your-frontend-domain.vercel.app` (production)
8. **Authorized redirect URIs**:
   - `http://localhost:3001/auth/google/callback` (development)
   - `https://your-backend-domain.onrender.com/auth/google/callback` (production)
9. Click **Create**
10. Copy **Client ID** và **Client Secret**

## Bước 4: Cấu hình Backend

1. Mở file `backend/.env`
2. Thêm/cập nhật các biến sau:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

## Bước 5: Chạy Migration

```bash
cd backend
npx prisma migrate dev --name add_google_auth
npx prisma generate
```

## Bước 6: Test

1. Chạy backend: `npm run start:dev`
2. Chạy frontend: `npm run dev`
3. Truy cập http://localhost:5173/login
4. Click **Đăng nhập với Google**

## Production Setup

Khi deploy lên production, cập nhật:

### Backend (.env trên Render)
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://your-backend.onrender.com/auth/google/callback
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (.env trên Vercel)
```env
VITE_API_URL=https://your-backend.onrender.com
```
