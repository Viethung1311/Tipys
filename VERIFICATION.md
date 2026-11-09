# Kết quả kiểm tra

Ngày: 09/11/2026.

## Đã đạt

- Build production bằng Vite thành công.
- 10 bài kiểm thử bộ luật: đếm ngược, chữ trùng, bấm sai, mất mạng, kết thúc, tạm dừng, tốc độ theo thời gian, giới hạn độ khó, túi phím và reset.
- 1 bài kiểm thử tương tác React bằng JSDOM: trang chủ → cài đặt → tùy chọn phím → chơi bằng sự kiện bàn phím và nút cảm ứng → tạm dừng → kết quả → lưu kỷ lục → chơi lại → trang chủ.
- Giữ phím lặp không cộng điểm; tạm dừng giữ nguyên thời gian; mất tiêu điểm tự dừng; chơi lại đặt lại điểm và mạng.
- npm audit tại thời điểm cài đặt: 0 lỗ hổng được báo cáo.
- Bản HTML độc lập đã được tạo từ bundle production.
- Cấu hình Vercel chạy build và kiểm thử trước khi hoàn thành deployment.

## Giới hạn xác minh

Chưa xác minh trực quan trong trình duyệt trên máy tính hoặc điện thoại. Truy cập localhost bị chặn trong môi trường chạy; trình duyệt tích hợp không cho phép mở file://. Kiểm thử JSDOM xác nhận hành vi và DOM nhưng không xác nhận kích thước, bố cục, âm thanh thật hoặc thao tác chạm trên thiết bị thật.

Để tái kiểm tra: `npm run build` rồi `npm test`.
