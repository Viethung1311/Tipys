# Kết quả kiểm tra

Ngày: 09/11/2026.

## Cập nhật âm thanh

- Build mới thành công; 19/19 kiểm thử đạt (11 bài trước và 8 bài mới cho âm thanh).
- Kiểm thử Web Audio bằng context giả: không tự phát trước thao tác người dùng; giới hạn âm chồng; chặn spam; mute và âm lượng 0; giai điệu kỷ lục thay hiệu ứng cũ; dừng/hủy nhạc khi tạm nghỉ hoặc rời game.
- Kiểm thử giao diện React với Web Audio giả: hiệu ứng bật, nhạc nền tắt mặc định; hai bộ điều chỉnh độc lập; lưu lựa chọn; đếm ngược đúng một âm cho mỗi nhịp; mở cài đặt trong game sẽ tạm dừng và dừng nhạc nền.
- Các kiểm thử giả lập xác nhận lập lịch và điều khiển âm, không đánh giá cảm nhận âm thanh bằng tai hoặc loa điện thoại vật lý.

## Đã đạt

- Build production bằng Vite thành công.
- 10 bài kiểm thử bộ luật: đếm ngược, chữ trùng, bấm sai, mất mạng, kết thúc, tạm dừng, tốc độ theo thời gian, giới hạn độ khó, túi phím và reset.
- 1 bài kiểm thử tương tác React bằng JSDOM: trang chủ → cài đặt → tùy chọn phím → chơi bằng sự kiện bàn phím và nút cảm ứng → tạm dừng → kết quả → lưu kỷ lục → chơi lại → trang chủ.
- Giữ phím lặp không cộng điểm; tạm dừng giữ nguyên thời gian; mất tiêu điểm tự dừng; chơi lại đặt lại điểm và mạng.
- npm audit tại thời điểm cài đặt: 0 lỗ hổng được báo cáo.
- Bản HTML độc lập đã được tạo từ bundle production.
- Cấu hình Vercel chạy build và kiểm thử trước khi hoàn thành deployment.

## Kiểm tra sau triển khai

- Production: https://tipys.vercel.app
- GitHub: https://github.com/Viethung1311/Tipys
- Vercel xác nhận Deployed to Production, build đầu tiên hoàn tất trong 23 giây từ commit 89fbede.
- Đã xem giao diện desktop và mô phỏng viewport điện thoại 390 × 844 trong trình duyệt thật.
- Trang cài đặt không tràn ngang ở chiều rộng 390px.
- Bấm nút bàn phím cảm ứng đúng chữ đang rơi: điểm tăng từ 0 lên 10.
- Gõ bàn phím vật lý đúng chữ: điểm tăng từ 10 lên 20.
- Tạm dừng hiển thị hộp thoại và cho phép tiếp tục hoặc về trang chủ.
- Console trình duyệt: không có lỗi hoặc cảnh báo trong lượt kiểm tra.
- Đã đưa trang về màn hình chính và khôi phục viewport mặc định sau thử nghiệm.

## Giới hạn xác minh

Chưa thử trên thiết bị iPhone/Android vật lý hoặc xác nhận âm thanh bằng tai. Kiểm tra điện thoại sử dụng viewport mô phỏng trong trình duyệt; hành vi chạm được xác nhận qua nút bàn phím trên web.

Để tái kiểm tra: `npm run build` rồi `npm test`.
