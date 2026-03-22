# Hướng dẫn chi tiết Deploy Backend (NestJS + PostgreSQL) lên VPS Ubuntu 24.04 LTS

Chào bạn, chúc mừng bạn đã có VPS đầu tiên! Vì backend của bạn sử dụng **NestJS** và **Prisma PostgreSQL**, việc deploy sẽ bao gồm cài đặt môi trường Node.js, cài đặt cơ sở dữ liệu PostgreSQL, đưa source code lên VPS và chạy ứng dụng thông qua PM2. 

Dưới đây là từng bước chi tiết dành cho người mới bắt đầu. Bạn hãy copy từng lệnh và dán vào terminal (bảng điều khiển SSH) của VPS nhé.

---

## Bước 1: Kết nối vào VPS

Mở Terminal (trên máy Mac) hoặc PowerShell/Command Prompt (trên Windows) và gõ lệnh sau:

```bash
ssh root@<IP_CỦA_VPS>
```

*(Thay `<IP_CỦA_VPS>` bằng địa chỉ IP VPS của bạn. Sau đó nhấn Enter, nếu có hỏi `Are you sure you want to continue connecting (yes/no/[fingerprint])?` thì gõ `yes` và nhập mật khẩu VPS của bạn).*

Sau khi vào được VPS, hãy cập nhật các phần mềm hệ thống để đảm bảo mọi thứ mới nhất:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Bước 2: Cài đặt Node.js và PM2

Backend NestJS cần Node.js để chạy. Trên Ubuntu 24.04, chúng ta sẽ cài Node.js phiên bản 20 (LTS):

**1. Cài đặt Node.js phiên bản 20:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-install -y nodejs
```

**2. Kiểm tra xem đã cài thành công chưa:**
```bash
node -v
npm -v
```
*(Nếu hiện ra phiên bản ví dụ `v20.x.x` là đã thành công)*

**3. Cài đặt PM2 (Công cụ giúp ứng dụng Node.js chạy ngầm liên tục ngay cả khi bạn tắt máy tính):**
```bash
sudo npm install -g pm2
```

---

## Bước 3: Cài đặt PostgreSQL (Cơ sở dữ liệu)

Vì app của bạn dùng `@prisma/adapter-pg` và `pg`, chúng ta cần cài PostgreSQL trên VPS.

**1. Cài đặt PostgreSQL:**
```bash
sudo apt install postgresql postgresql-contrib -y
```

**2. Tạo Database và User cho ứng dụng của bạn:**
```bash
sudo -u postgres psql
```
Lệnh này sẽ đưa bạn vào màn hình dòng lệnh của PostgreSQL (bạn sẽ thấy dấu nhắc lệnh chuyển thành `postgres=#`). Hãy gõ lần lượt các lệnh SQL sau:

```sql
CREATE DATABASE hoc_tieng_trung_db;
CREATE USER myuser WITH ENCRYPTED PASSWORD 'mypassword123';
GRANT ALL PRIVILEGES ON DATABASE hoc_tieng_trung_db TO myuser;
ALTER DATABASE hoc_tieng_trung_db OWNER TO myuser;
\q
```
*(Lưu ý: Bạn có thể đổi `mypassword123` thành mật khẩu khác an toàn hơn. Lệnh `\q` dùng để thoát khỏi PostgreSQL).*

---

## Bước 4: Đưa mã nguồn (Source Code) lên VPS

Cách dễ nhất là đưa source code của bạn lên **GitHub**, sau đó Clone về VPS.
Giả sử bạn đã đẩy thư mục `backend` lên GitHub.

**1. Cài đặt Git trên VPS:**
```bash
sudo apt install git -y
```

**2. Clone mã nguồn về VPS:**
```bash
# Thay đường dẫn github phía dưới bằng link repo của bạn
git clone https://github.com/ten-cua-ban/web_app_hoc_tieng_trung.git
```

**3. Di chuyển vào thư mục backend:**
```bash
cd web_app_hoc_tieng_trung/backend
```

---

## Bước 5: Thiết lập biến môi trường (.env)

Trên VPS, bạn cần tạo file `.env` y hệt như dưới máy tính của bạn.

**1. Tạo file `.env`:**
```bash
nano .env
```

**2. Điền thông tin vào file `.env`:**
Copy nội dung tương tự file `.env` ở máy tính của bạn dán vào đây. **Lưu ý quan trọng: hãy sửa chuỗi kết nối Database (DATABASE_URL) theo user và mật khẩu PostgreSQL bạn vừa tạo ở Bước 3.**

Ví dụ: 
```env
DATABASE_URL="postgresql://myuser:mypassword123@localhost:5432/hoc_tieng_trung_db?schema=public"
# ... Các cài đặt khác (JWT_SECRET, CLOUDINARY, v.v...) của bạn
```

**3. Lưu file và thoát:**
Nhấn `Ctrl + O` (chữ O) -> Nhấn `Enter` để lưu -> Nhấn `Ctrl + X` để thoát.

---

## Bước 6: Cài đặt thư viện, Migrate Database và Build Code

Bạn cần đảm bảo đang đứng ở trong thư mục `backend` trên VPS:

**1. Cài đặt các gói thư viện Node.js:**
```bash
npm install
```

**2. Chạy Prisma Migrate để tạo các bảng trong Database PostgreSQL:**
```bash
npx prisma generate
npx prisma migrate deploy
```
*(Nếu bạn có lệnh seed data theo package.json, hãy chạy: `npm run seed` hoặc `npm run seed:achievements` để khởi tạo dữ liệu mẫu nếu cần)*

**3. Build source code NestJS sang thư mục `dist`:**
```bash
npm run build
```

---

## Bước 7: Khởi chạy Backend với PM2

Sử dụng script `start:prod` trong file `package.json` của bạn để chạy app thông qua PM2:

```bash
pm2 start "npm run start:prod" --name "backend-hoc-tieng-trung"
```

**Lưu cấu hình PM2 để tự động chạy lại app mỗi khi VPS khởi động lại ban đêm hoặc cúp điện:**
```bash
pm2 save
pm2 startup
```
*(Khi chạy lệnh `pm2 startup`, nó sẽ in ra một dòng lệnh dài ở cuối màn hình. Hãy copy dòng lệnh đó và dán chạy lại một lần nữa).*

Bạn có thể xem log chạy thực tế của app để xem app báo "Nest application successfully started" hay không:
```bash
pm2 logs backend-hoc-tieng-trung
```

---

## Bước 8: Mở Port cho Firewall (Tường lửa)

Theo mặc định NestJS chạy ở port 3000 hoặc port bạn cấu hình trong `.env` (ví dụ port 8080). Để bên ngoài trình duyệt hay frontend gọi được vào API, bạn phải mở port tường lửa của Ubuntu:

```bash
# Giả sử backend của bạn chạy port 3000
sudo ufw allow 3000/tcp
sudo ufw allow 22/tcp  # Đảm bảo SSH không bị chặn
sudo ufw enable
```

**Hoàn thành!** 🎉
Lúc này bạn có thể vào Postman hoặc trình duyệt gọi thử: `http://<IP_CỦA_VPS>:3000/api` (Tùy thuộc port và route của bạn) để kiểm tra backend đã sống hay chưa.

---

> **Lưu ý nâng cao (Tùy chọn cho sau này):** 
> Hiện tại truy cập vào IP bằng Port trông khá thiếu chuyên nghiệp (ví dụ Http://12.34.56.78:3000). Ở bước kế tiếp (khi bạn đã mua tên miền "Domain"), chúng ta sẽ dùng Nginx (Reverse Proxy) để gán tên miền (như `api.hoctiengtrung.com`) và cài SSL (HTTPS bảo mật) thay cho việc gọi qua cổng 3000.  

*Bạn hãy thử thao tác đến Bước 7-8 trước nhé, nếu gõ lệnh nào báo lỗi đỏ thì hãy copy lỗi đó gửi cho mình để mình hỗ trợ gỡ lỗi.*
