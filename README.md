# Our Journey

Web app chạy trên điện thoại: bản đồ chữ S của hai đứa. Mỗi nơi đã đến là một chiếc ghim, có đường nối theo thứ tự thời gian, nhật ký theo lịch, album ảnh, và hai người dùng chung được.

## Dùng thế nào

- **Nút Check-in ở giữa**: bấm một lần là lưu ngay vị trí và giờ hiện tại. Tên, ảnh, cảm nhận bổ sung sau.
  - Đứng gần một nơi đã từng ghé (trong 100 m) thì app tự lấy tên nơi đó và nhắc lại lần trước: ngày, số tim, feedback.
  - Nơi mới thì app tự tìm tên quán, địa chỉ, tỉnh thành khi có mạng.
  - Thẻ nhỏ hiện ra sau khi check-in để chấm tim, thêm ảnh, bổ sung hoặc hoàn tác.
- **Cung đường**: mỗi chuyến phượt là một cung có tên.
  - Trước khi đi bấm **Bắt đầu cung mới** và đặt tên. Từ đó mỗi lần check-in, điểm đó tự vào cung. Về tới nơi bấm **Kết thúc cung**.
  - Chuyến đã đi rồi: tạo cung với “Từ ngày – Đến ngày”, app gom mọi check-in trong khoảng đó. App cũng tự gợi ý cung từ những ngày liền nhau có nhiều check-in.
  - Trang tổng kết của cung: tổng km, số chặng (mỗi ngày một chặng), điểm dừng, ảnh; từng chặng liệt kê các điểm theo giờ kèm số km giữa hai điểm; xem trên bản đồ và **Phát lại**.
  - Số km tính theo đường bộ (dịch vụ dẫn đường OSRM của OpenStreetMap), được lưu lại trong máy. Khi chưa có mạng, app tạm ước tính theo đường thẳng và ghi dấu ≈.
- **Bản đồ**: mặc định vừa khung Việt Nam. Ghim gom theo quốc gia → tỉnh/thành → từng địa điểm khi phóng to.
  - Đường của mỗi cung đi theo đường thật, mỗi cung một màu, có mũi tên chỉ hướng và số chặng. Chạm vào đường để mở tổng kết cung.
  - Khi đang đi một cung, thanh nhỏ ở đáy bản đồ cho biết số km, số điểm, số chặng.
  - Nút **Danh sách** mở sổ địa điểm kèm feedback của vùng đang xem, có bộ lọc (yêu thích, đáng quay lại, quán ăn, cà phê…).
  - Nút tuỳ chọn (góc phải): kiểu bản đồ, bật/tắt đường đi, bắt đầu cung mới, ghim một nơi khác, ghi đường đi bằng GPS.
- **Nhật ký**: lịch tháng, ngày có kỉ niệm được tô màu kèm số lượng. Bấm một ngày thì lịch thu lại còn một tuần và hiện kỉ niệm ngày đó bên dưới. Có nút thêm kỉ niệm cho một ngày cũ. Chuyển sang **Ảnh** để xem album theo tháng hoặc theo nơi.
- **Tổng kết**: đã đi mấy trên 34 tỉnh thành, sổ đóng dấu theo miền, số liệu, phần dùng chung và sao lưu.

## Dùng chung hai người

Dữ liệu luôn nằm trong máy (dùng được khi mất mạng). Khi bật dùng chung, mỗi thay đổi được gửi lên Cloud Firestore của **dự án Firebase do bạn tạo**, và máy kia nhận về. Mỗi check-in ghi rõ ai đăng.

### Người thứ nhất: tạo Firebase (một lần, khoảng 10 phút)

1. Mở <https://console.firebase.google.com>, đăng nhập Google, bấm **Create a project**. Đặt tên bất kỳ, tắt Google Analytics, bấm Create.
2. Menu trái: **Build → Firestore Database → Create database**. Chọn vị trí gần Việt Nam (ví dụ `asia-southeast1`), chọn **production mode**, bấm Create.
3. Vào thẻ **Rules**, xoá hết nội dung cũ, dán đoạn dưới rồi bấm **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /spaces/{space}/{coll}/{doc} {
         allow read, write: if space.size() >= 18;
       }
     }
   }
   ```

4. Bấm biểu tượng bánh răng → **Project settings**. Ở mục **Your apps**, bấm biểu tượng `</>` (Web), đặt tên, bấm Register app.
5. Sao chép cả đoạn `firebaseConfig = { … }`.
6. Trong app: **Tổng kết → Thiết lập dùng chung → Mình tạo mới**. Nhập tên, dán đoạn `firebaseConfig`, bấm **Tạo không gian chung**.
7. Bấm **Sao chép mã mời** và gửi cho người kia.

Tên các nút trong Firebase console có thể khác đôi chút theo thời gian.

### Người thứ hai

Mở app → **Tổng kết → Thiết lập dùng chung → Mình có mã mời** → nhập tên, dán mã mời → **Tham gia**.

Nếu cài app ra màn hình chính iPhone thì làm các bước này trong app đã cài, vì app đã cài có bộ nhớ riêng, tách khỏi Safari.

### Cần biết

- Không gian chung được bảo vệ bằng một mã ngẫu nhiên dài nằm trong mã mời. **Ai có mã mời đều xem và sửa được dữ liệu chung**, nên chỉ gửi cho đúng người.
- Ảnh được lưu thẳng trong Firestore (mỗi ảnh tối đa khoảng 0,9 MB, app tự nén). Gói miễn phí của Firebase có 1 GB, đủ cho vài nghìn ảnh.
- Dữ liệu mẫu và hành trình GPS đang ghi dở không được gửi đi.
- “Xoá tất cả” chỉ xoá trên máy đang dùng và ngừng dùng chung trên máy đó.

## Cài lên điện thoại

Mở link GitHub Pages của repo này bằng Safari (iPhone) hoặc Chrome (Android), rồi chọn **Thêm vào Màn hình chính**. Trình duyệt chỉ cho dùng GPS khi trang chạy qua HTTPS.

> Ghi đường đi bằng GPS chỉ hoạt động khi màn hình đang mở và app đang hiển thị. Check-in thì không cần.

## Chạy thử trên máy tính

```bash
python3 -m http.server 8080
# mở http://localhost:8080
```

## Cấu trúc

```
index.html            khung giao diện
css/style.css         giao diện glass (hồng, trắng, be)
js/app.js             bản đồ, check-in, cung đường, nhật ký, tổng kết
js/sync.js            dùng chung qua Firebase (Cloud Firestore)
js/geo.js             34 tỉnh thành, quy đổi tên cũ, nhận diện tỉnh/quốc gia
js/vn-shape.js        đường viền Việt Nam (Natural Earth, dữ liệu công cộng)
js/db.js              lưu trữ trong máy (IndexedDB)
js/demo.js            dữ liệu mẫu
js/icons.js           bộ icon SVG
sw.js                 service worker (mở được khi mất mạng)
vendor/leaflet/       thư viện bản đồ Leaflet 1.9.4
vendor/firebase/      Firebase JS SDK 10.14.1 (chỉ tải khi bật dùng chung)
```

Tỉnh/thành theo đơn vị hành chính sau sáp nhập 1/7/2025 (34 tỉnh thành); tên tỉnh cũ được tự quy về đơn vị mới.

Dịch vụ dùng: ô bản đồ © OpenStreetMap contributors, © CARTO, ảnh vệ tinh © Esri; tìm kiếm và lấy địa chỉ qua Nominatim (OpenStreetMap); đường đi theo đường bộ qua máy chủ demo của OSRM (router.project-osrm.org).
