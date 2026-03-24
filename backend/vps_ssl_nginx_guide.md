# Hướng Dẫn Cấu Hình Tên Miền và HTTPS (Ổ Khoá Xanh) cho VPS Ubuntu

Frontend của bạn (`https://kaiyu.taidt.id.vn`) bị chặn không cho gọi API vì khác chuẩn bảo mật. Để giải quyết, chúng ta cần cấp cho Backend một tên miền phụ (Sub-domain) là `api.kaiyu.taidt.id.vn` kèm theo bộ bảo mật HTTPS giống hệt Frontend.

Dưới đây là 3 bước cực kì dễ hiểu để cấu hình:

---

## BƯỚC 1: Trỏ Tên Miền (DNS) ở chỗ mua tên miền
Bạn cần truy cập vào trang quản lý tên miền (nhà cung cấp mà bạn đã mua tên miền `taidt.id.vn` như Tenten, iNet, MatBao, Cloudflare...).

**1.** Vào phần "Quản lý DNS" (hoặc "Cấu hình tên miền").
**2.** Thêm một **Bản ghi mới (Record)** với dữ liệu như sau:
   - **Loại (Type):** `A`
   - **Tên (Host / Record):** `api` (Nghĩa là bạn tạo subdomain `api.kaiyu.taidt.id.vn` hoặc `api.taidt.id.vn` tuỳ bạn muốn). Tốt nhất bạn nên đặt Host là `api.kaiyu` để nó ghép với `taidt.id.vn` thành `api.kaiyu.taidt.id.vn`.
   - **Giá trị (Value / IP Address):** `103.200.23.36` (IP VPS của bạn)
   - **TTL:** Mặc định hoặc Auto.

*(Bạn có thể nghỉ giải lao 5-10 phút để hệ thống mạng toàn cầu cập nhật địa chỉ IP của tên miền mới này).*

---

## BƯỚC 2: Cài Đặt và Cấu Hình Nginx trên VPS
Bây giờ kết nối màn hình đen (SSH) vào con VPS của bạn bằng quyền `root` để làm tiếp:

**1. Cài phần mềm máy chủ Nginx:**
```bash
sudo apt update
sudo apt install nginx -y
```

**2. Mở cổng mạng web (Port 80 và 443) cho Ubuntu:**
```bash
sudo ufw allow 'Nginx Full'
```

**3. Tạo file cấu hình Nginx đứng ra làm cầu nối cho Backend (Cổng 3000):**
```bash
nano /etc/nginx/sites-available/api_kaiyu
```

**4. Dán đoạn mã cầu nối sau vào màn hình soạn thảo (Nhớ đổi đúng tên miền bạn vừa trỏ ở Bước 1 nhé):**
```nginx
server {
    listen 80;
    server_name api.kaiyu.taidt.id.vn; # Thay tên miền của bạn vào đây

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
*Lưu file bằng `Ctrl + O` -> `Enter` -> `Ctrl + X`.*

**5. Kích hoạt và kiểm tra cấu hình Nginx:**
```bash
# Kích hoạt file cấu hình vừa tạo
sudo ln -s /etc/nginx/sites-available/api_kaiyu /etc/nginx/sites-enabled/

# Kiểm tra xem file cấu hình dán đúng chưa (Báo syntax is ok là ngon)
sudo nginx -t

# Chạy lại máy chủ Nginx
sudo systemctl restart nginx
```

Lúc này, bạn thử gõ lên trình duyệt đường dẫn: `http://api.kaiyu.taidt.id.vn` (có thể thêm `/api/docs` vào sau đuôi) mà nó hiện ra là đã chuyển tiếp (Reverse Proxy) thành công rồi đó!

---

## BƯỚC 3: Cài đặt SSL "Ổ khoá xanh" bằng Certbot (Let's Encrypt)
Chỉ còn 1 bước cài đặt chứng chỉ bảo mật cho đuôi `https://` là vạn sự hoàn thành!

**1. Cài đặt Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

**2. Chạy lệnh xin cấp phát chứng chỉ HTTPS:**
```bash
sudo certbot --nginx -d api.kaiyu.taidt.id.vn
```

**Lúc đang chạy lệnh này, nó sẽ hỏi bạn một số thông tin cấu hình:**
- **Email address:** Bạn gõ đại email của bạn vào (để nó nhắc hạn) -> Bấm Enter.
- Mấy câu hỏi `(Y/n)` thì bạn cứ gõ `Y` rồi Enter.
- Certbot sẽ liên hệ tự động với Nginx để cài một ổ khoá xanh, sau vài chục giây sẽ báo **"Successfully received certificate."** (Chúc mừng).

---

🎉 **HOÀN THÀNH - CHIẾN THẮNG LỖI MIXED CONTENT!**
- Quay lại Frontend `.env.local`, lần này hãy đổi URL tự tin thành `https://api.kaiyu.taidt.id.vn/api`.
- Push sương sương lại con code lên Vercel để nó gọi HTTPS cho đồng bộ nhé hihi! Khúc mắc ở đâu cứ chụp ném vào đây mình đỡ cho.
