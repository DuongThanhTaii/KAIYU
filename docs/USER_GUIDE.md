# Hướng Dẫn Sử Dụng - Web App Học Tiếng Trung

## 📋 Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Test Cases & Kết Quả](#test-cases--kết-quả)
3. [Hướng Dẫn Cho User](#hướng-dẫn-cho-user)
4. [Hướng Dẫn Cho Admin](#hướng-dẫn-cho-admin)
5. [Tài Khoản Test](#tài-khoản-test)

---

## Tổng Quan

Ứng dụng học tiếng Trung với các tính năng chính:
- **Authentication**: Đăng ký, đăng nhập, quản lý profile
- **Video Learning**: Xem video với phụ đề tiếng Trung
- **Vocabulary**: Lưu và quản lý từ vựng cá nhân
- **Flashcards**: Ôn tập với hệ thống SRS (Spaced Repetition)
- **Progress Tracking**: Theo dõi tiến độ học tập
- **Admin Panel**: Quản lý nội dung (video, từ vựng, users)

---

## Test Cases & Kết Quả

### ✅ Phase 1: Authentication
| Test Case | Kết Quả | Ghi Chú |
|-----------|---------|---------|
| TC1.1: Đăng ký tài khoản mới | ✅ Pass | Redirect về dashboard |
| TC1.2: Đăng ký email đã tồn tại | ✅ Pass | Hiển thị lỗi 409 |
| TC1.3: Login đúng email/password | ✅ Pass | Nhận JWT token |
| TC1.4: Login sai password | ✅ Pass | Hiển thị lỗi 401 |
| TC1.5: Truy cập protected route khi chưa login | ✅ Pass | Redirect về /login |
| TC1.6: Logout | ✅ Pass | Xóa token, redirect về /login |

### ✅ Phase 2-6: Core Features
| Module | Status | API Endpoints |
|--------|--------|---------------|
| Vocabulary | ✅ | GET/POST /vocabulary |
| User Vocabulary | ✅ | GET/POST/DELETE /user-vocabulary |
| Videos | ✅ | GET /videos, subtitles, vocabulary |
| Flashcards | ✅ | GET /flashcards/queue, POST /review |
| Progress | ✅ | GET/PUT /progress |
| Admin | ✅ | Full CRUD /admin/* |
| Upload (S3) | ✅ | POST /upload/video, /upload/image |

---

## Hướng Dẫn Cho User

### 1. Đăng Ký Tài Khoản

1. Truy cập **http://localhost:5173/register**
2. Điền thông tin:
   - **Họ tên**: Tên hiển thị của bạn
   - **Email**: Email đăng nhập
   - **Mật khẩu**: Tối thiểu 6 ký tự
   - **Xác nhận mật khẩu**: Nhập lại
   - **Trình độ HSK**: Chọn level hiện tại (1-6)
3. Bấm **Đăng ký**
4. Hệ thống sẽ tự động chuyển về Dashboard

### 2. Đăng Nhập

1. Truy cập **http://localhost:5173/login**
2. Nhập email và mật khẩu
3. Bấm **Đăng nhập**
4. (Tùy chọn) Sử dụng **Đăng nhập với Google**

### 3. Dashboard (`/dashboard`)

- **Tiến độ hàng ngày**: Xem số phút học, từ vựng mới
- **Streak**: Số ngày liên tục học
- **Recommended**: Video và bài học được đề xuất
- **Quick Actions**: Truy cập nhanh các tính năng

### 4. Thư Viện Video (`/learn`)

1. **Xem danh sách video**: Lọc theo HSK level hoặc category
2. **Tìm kiếm**: Gõ từ khóa vào ô search
3. **Xem chi tiết**: Click vào video để xem thông tin
4. **Xem video**: Click Play để bắt đầu học

### 5. Video Player (`/learn/:id/play`)

- **Phụ đề tương tác**: Click vào từ để xem nghĩa
- **Lưu từ vựng**: Click bookmark để lưu vào notebook
- **Loop câu**: Lặp lại câu hiện tại để luyện nghe
- **Tốc độ**: Điều chỉnh 0.5x - 2x

### 6. Sổ Từ Vựng (`/vocab`)

- **Xem từ đã lưu**: Danh sách từ vựng cá nhân
- **Lọc theo proficiency**: New, Learning, Review, Mastered
- **Xem chi tiết**: Click vào từ để xem nghĩa, ví dụ
- **Xóa từ**: Click icon thùng rác

### 7. Ôn Tập Flashcard (`/review`)

1. Hệ thống hiển thị từ cần ôn
2. Xem mặt trước (Hanzi)
3. Click để lật (xem Pinyin, nghĩa)
4. Đánh giá: **Lại** | **Khó** | **Tốt** | **Dễ**
5. Hệ thống tự động lên lịch ôn tiếp theo

### 8. Cài Đặt (`/settings`)

- **Thông tin cá nhân**: Đổi tên, avatar
- **Mục tiêu học**: Số phút/ngày
- **Đổi mật khẩu**: Nhập mật khẩu cũ và mới
- **HSK Level**: Cập nhật trình độ

---

## Hướng Dẫn Cho Admin

### Đăng Nhập Admin

Sử dụng tài khoản có role **admin** để truy cập các trang quản trị.

### 1. Admin Dashboard (`/admin`)

- **Thống kê tổng quan**: Users, Videos, Vocabulary
- **Users gần đây**: Danh sách đăng ký mới
- **Quick actions**: Truy cập nhanh đến quản lý

### 2. Quản Lý Video (`/admin/videos`)

#### Thêm Video YouTube:
1. Click **Thêm Video**
2. Điền thông tin:
   - **Tiêu đề**: Tên video
   - **Mô tả**: Nội dung tóm tắt
   - **Video URL**: Link YouTube (ví dụ: `https://youtube.com/watch?v=xxx`)
   - **HSK Level**: 1-6
   - **Category**: Daily Life, Travel, Business...
3. Click **Lưu**

#### Upload Video lên S3:
1. Cấu hình AWS S3 trong `backend/.env` (xem phần cuối)
2. Click **Upload Video**
3. Chọn file MP4/WebM (tối đa 500MB)
4. Đợi upload hoàn tất
5. URL sẽ tự động điền

#### Quản lý Phụ đề:
1. Mở video cần thêm phụ đề
2. Click **Thêm Subtitles**
3. Import file SRT hoặc nhập thủ công
4. Mỗi dòng: thời gian bắt đầu, kết thúc, text

### 3. Quản Lý Từ Vựng (`/admin/vocabulary`)

#### Thêm từ mới:
1. Click **Thêm Từ**
2. Điền:
   - **Hanzi**: 你好
   - **Pinyin**: nǐ hǎo
   - **Nghĩa Anh**: Hello
   - **Nghĩa Việt**: Xin chào
   - **Loại từ**: Phrase, Verb, Noun...
   - **HSK Level**: 1-6
   - **Tags**: greeting, polite...
3. Click **Lưu**

#### Import từ CSV:
1. Click **Import**
2. Chọn format **CSV**
3. Upload file với cấu trúc:
```csv
hanzi,pinyin,meaningEn,meaningVi,partOfSpeech,hskLevel
你好,nǐ hǎo,Hello,Xin chào,phrase,1
```
4. Xem preview và **Xác nhận Import**

#### Export:
- Click **Export CSV** hoặc **Export JSON**
- File sẽ tự động download

### 4. Quản Lý Users (`/admin/users`)

- **Xem danh sách**: Tất cả users với thống kê
- **Đổi role**: Click vào user > Đổi role (user/admin)
- **Xem chi tiết**: Số từ đã học, progress

---

## Tài Khoản Test

### User Account
- **Email**: testuser@example.com
- **Password**: Test123456
- **Role**: user

### Tạo Admin Account

Chạy lệnh SQL sau trong database:

```sql
-- Tìm user và đổi role thành admin
UPDATE "User" 
SET role = 'admin' 
WHERE email = 'testuser@example.com';
```

Hoặc đăng ký tài khoản mới rồi đổi role trong database.

---

## Cấu Hình AWS S3 (Tùy Chọn)

Nếu muốn upload video/ảnh lên S3:

1. **Tạo S3 Bucket** trên AWS Console
2. **Cấu hình CORS** cho bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

3. **Thêm vào `backend/.env`**:
```env
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=wJalrXXXXXXXXXXXXXXXXXXXX
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-bucket-name
```

4. Restart backend server

---

## Khởi Động Ứng Dụng

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
