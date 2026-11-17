# Our Journey

Web app chạy trên điện thoại: bản đồ chữ S của hai đứa. Mỗi nơi đã đến là một chiếc ghim, có đường nối theo thứ tự thời gian, nhật ký theo lịch, album ảnh, và hai người dùng chung được.

## Dùng thế nào

- **Nút Check-in** (góc phải dưới): bấm một lần là ghim ngay chỗ đang đứng. Thẻ nhỏ hiện ra để chọn **cung** (hoặc tạo cung mới ngay tại đó), chấm tim, thêm ảnh. Tên, cảm nhận bổ sung sau bằng nút **Chi tiết**. Bấm giữ trên bản đồ hoặc chọn một kết quả tìm kiếm cũng ghim ngay như vậy.
  - Đứng gần một nơi đã từng ghé (trong 100 m) thì app tự lấy tên nơi đó và nhắc lại lần trước.
- **Cung đường**: mỗi chuyến phượt là một cung có tên.
  - **Bắt đầu cung mới** trước khi đi: mọi check-in sau đó tự vào cung. Về tới nơi bấm **Kết thúc cung**.
  - **Thêm cung đã đi** cho chuyến cũ: đặt tên, chọn ngày đi – ngày về, rồi thêm các nơi đã đến: chọn ngày, gõ tên nơi (ví dụ “Mã Pí Lèng”) và bấm ＋, hoặc **Ghim trên bản đồ**. Check-in cũ chưa thuộc cung nào cũng thêm được vào cung.
  - Trang tổng kết của cung: tổng km, số chặng (mỗi ngày một chặng), điểm dừng theo giờ kèm km giữa hai điểm, ảnh; nút **Thêm điểm**, **Trên bản đồ**, **Phát lại**, **Ảnh chia sẻ**.
  - Số km tính theo đường bộ (OSRM của OpenStreetMap), lưu lại trong máy; chưa có mạng thì tạm ước tính theo đường thẳng và ghi dấu ≈.
- **Bản đồ**: mặc định vừa khung Việt Nam. Ghim gom theo quốc gia → tỉnh/thành → từng địa điểm khi phóng to. Chỉ đường của các cung được vẽ (mỗi cung một màu); xem riêng một cung thì chỉ còn các điểm của cung, đánh số theo thứ tự đến, và đường tự vẽ ra. Thẻ ở đáy thu gọn sẵn, chạm tiêu đề để mở.
- **Kỉ niệm**: thẻ **Tổng kết hành trình** mở story nhiều trang (số km so với chiều dài chữ S, các tỉnh đã đến trên bản đồ, cung dài nhất, những nơi được thả tim nhiều nhất…), mỗi trang **lưu / chia sẻ** thành ảnh dọc 1080×1920. Bên dưới là lịch tháng (bấm một ngày để xem ngày đó) và album ảnh. Nút bánh răng mở **Cài đặt**: dùng chung, sao lưu, dữ liệu mẫu.

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
6. Trong app: **Kỉ niệm → Cài đặt (bánh răng) → Thiết lập dùng chung → Mình tạo mới**. Nhập tên, dán đoạn `firebaseConfig`, bấm **Tạo không gian chung**.
7. Bấm **Sao chép mã mời** và gửi cho người kia.

Tên các nút trong Firebase console có thể khác đôi chút theo thời gian.

### Người thứ hai

Mở app → **Kỉ niệm → Cài đặt → Thiết lập dùng chung → Mình có mã mời** → nhập tên, dán mã mời → **Tham gia**.

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
js/app.js             bản đồ, check-in, cung đường, kỉ niệm, cài đặt
js/story.js           story tổng kết vẽ bằng canvas, lưu/chia sẻ ảnh
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

Dịch vụ dùng: ô bản đồ © OpenStreetMap contributors (tile.openstreetmap.org), ảnh vệ tinh © Esri; tìm kiếm và lấy địa chỉ qua Nominatim (OpenStreetMap); đường đi theo đường bộ qua máy chủ demo của OSRM (router.project-osrm.org).
