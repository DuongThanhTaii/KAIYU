# JMeter Load Test Guide (Beginner Friendly)

Muc tieu:

- p95 response time < 5000ms
- Error rate < 1%
- Throughput on dinh

Bo file da san:

- `tests/jmeter/prod-load-test.jmx`
- `tests/jmeter/users.example.csv`

## 1) Cai dat JMeter tren Windows

### Buoc 1: Cai Java (JDK 17 hoac 21)

1. Cai JDK.
2. Mo PowerShell/CMD:

```bat
java -version
```

Neu thay version la OK.

### Buoc 2: Tai va mo JMeter

1. Tai Apache JMeter zip (ban moi nhat).
2. Giai nen, vi du: `C:\tools\apache-jmeter-5.6.3`
3. Chay GUI:

```bat
C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat
```

## 2) Chuan bi file users

1. Copy file mau:

```bat
copy tests\jmeter\users.example.csv tests\jmeter\users.csv
```

2. Sua `tests/jmeter/users.csv` thanh tai khoan that de test:

```csv
email,password
loadtest1@yourdomain.com,YourPassword123!
loadtest2@yourdomain.com,YourPassword123!
```

Luu y:

- Nen dung account test rieng, khong dung account admin quan trong.
- Nen co it nhat 5-20 account de giam xung dot session.

## 3) Import va cau hinh test plan

1. Mo JMeter GUI.
2. File > Open > chon `tests/jmeter/prod-load-test.jmx`.
3. Trong Test Plan > User Defined Variables, sua:

- `PROTOCOL`: `https` (hoac `http`)
- `HOST`: domain backend (vi du `api.yourdomain.com`)
- `THREADS`: so user ao
- `RAMP_UP`: thoi gian tang tai (giay)
- `DURATION`: tong thoi gian test (giay)
- `P95_TARGET_MS`: 5000

## 4) Chay theo 4 pha an toan

Khuyen nghi chay tu nhe den nang:

1. Smoke:

- THREADS=5
- RAMP_UP=60
- DURATION=180

2. Baseline:

- THREADS=20
- RAMP_UP=120
- DURATION=600

3. Load:

- THREADS=50
- RAMP_UP=180
- DURATION=900

4. Stress (co giam sat):

- THREADS=100
- RAMP_UP=300
- DURATION=1200

Neu error rate vuot 3% thi dung ngay de tranh rui ro.

## 5) Chay non-GUI (khuyen nghi cho test that)

### Lenh co ban

```bat
C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat -n -t tests\jmeter\prod-load-test.jmx -l tests\jmeter\results.jtl -e -o tests\jmeter\report
```

### Override bien khi chay

```bat
C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat -n -t tests\jmeter\prod-load-test.jmx -l tests\jmeter\results-baseline.jtl -e -o tests\jmeter\report-baseline -JPROTOCOL=https -JHOST=api.yourdomain.com -JTHREADS=20 -JRAMP_UP=120 -JDURATION=600 -JP95_TARGET_MS=5000
```

Mo bao cao HTML:

- `tests/jmeter/report-baseline/index.html`

## 6) Cach doc ket qua (chi can nhin 4 chi so)

1. p95 (95% Line):

- Dat neu < 5000ms

2. Error %:

- Dat neu < 1%

3. Throughput:

- Khong sut manh theo thoi gian

4. Top endpoint cham:

- Tim sampler co Avg/p95 cao nhat de toi uu dung diem

## 7) Checklist test production an toan

1. Chay ngoai gio cao diem.
2. Co dashboard monitor CPU/RAM/DB connection truoc khi bat dau.
3. Test account rieng, data rieng.
4. Tang tai theo pha, khong nhay thang len 100 threads.
5. Dung test neu error > 3% hoac p95 tang dot bien keo dai.

## 8) Luong API dang duoc script nay test

1. `POST /api/auth/login`
2. `GET /api/auth/me`
3. `GET /api/videos?page=1&limit=12`
4. `GET /api/videos/{id}/subtitles`
5. `PUT /api/progress/videos/{id}`
6. `POST /api/videos/{id}/view`
7. `GET /api/videos/recommendations?context=learn&limit=4`
8. `GET /api/progress/videos`

`videoId` duoc tu dong extract tu ket qua `/api/videos`.

## 9) Luu y quan trong

- Script nay la load test API, khong phai browser test full frontend.
- De ket qua tin cay, may chay JMeter nen khac server backend.
- Neu backend co WAF/rate-limit, can whitelist IP test.
