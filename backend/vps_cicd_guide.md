# Hướng Dẫn Thiết Lập Tự Động Deploy (CI/CD) với GitHub Actions

Để đạt được tính năng "Push code lên GitHub là VPS tự động cập nhật", bạn cần thực hiện các bước sau:

---

## BƯỚC 1: Tạo Chìa Khóa Bảo Mật (SSH Key) trên VPS

Bạn hãy kết nối SSH vào VPS (màn hình đen) và chạy lần lượt các lệnh sau:

**1. Tạo bộ chìa khóa mới:**
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy"
```
*(Khi nó hỏi lưu ở đâu, cứ nhấn **Enter**. Khi hỏi mật khẩu (passphrase), cứ nhấn **Enter** 2 lần để trống).*

**2. Đưa chìa khóa vào danh sách tin tưởng:**
```bash
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
```

**3. Lấy chìa khóa riêng (Private Key) để dán vào GitHub:**
```bash
cat ~/.ssh/id_rsa
```
*(Bạn hãy bôi đen và **Copy toàn bộ** nội dung hiện ra, từ dòng `-----BEGIN RSA PRIVATE KEY-----` cho đến hết dòng `-----END RSA PRIVATE KEY-----`).*

---

## BƯỚC 2: Thêm Chìa Khóa vào GitHub (Secrets)

**1.** Truy cập vào Repository của bạn trên GitHub: `https://github.com/DuongThanhTaii/KAIYU`
**2.** Vào tab **Settings** -> Phía tay trái chọn **Secrets and variables** -> **Actions**.
**3.** Nhấn nút **New repository secret** và thêm 2 Secret sau:

- **Secret 1:**
  - Name: `SSH_PRIVATE_KEY`
  - Secret: (Dán toàn bộ nội dung bạn vừa copy từ lệnh `cat ~/.ssh/id_rsa` ở Bước 1).
- **Secret 2:**
  - Name: `VPS_IP`
  - Secret: `103.200.23.36`

---

## BƯỚC 3: Kích Hoạt Tự Động Hóa

Mình đã tạo sẵn file cấu hình `.github/workflows/deploy.yml` trong code của bạn. Bây giờ bạn chỉ cần:

**1. Lưu lại các thay đổi và Push code lên GitHub:**
```bash
git add .
git commit -m "feat: setup github actions for auto-deploy"
git push origin main
```

**2. Kiểm tra tiến trình:**
- Lên GitHub, vào tab **Actions**.
- Bạn sẽ thấy một tiến trình đang chạy. Nếu nó hiện dấu tích xanh ✅, nghĩa là VPS của bạn đã được cập nhật code mới và tự động Restart rồi đó!

---

🎉 **Từ nay về sau, mỗi khi bạn Push code, hãy cứ yên tâm đi pha một ly cafe, VPS sẽ tự làm hết phần còn lại!**
