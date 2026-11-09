# Kết quả kiểm tra

Ngày: 09/11/2026.

## Mốc điểm / bảng top / loading

- Tăng tốc tại 500, 1.000, 1.500 điểm và mỗi 500 điểm tiếp theo; không tăng theo thời gian. Chữ đang rơi và chữ mới đều áp dụng tốc độ mới, có giới hạn admin.
- Bảng top 50 đọc best_play, một hàng/học sinh, sắp điểm giảm dần; chỉ học sinh đang hoạt động, cần đăng nhập để xem.
- Loading typing TIPY có từng chữ nhỏ đến lớn, dùng trước khi JavaScript tải xong và khi đang gọi API; tắt chuyển động theo thiết lập giảm chuyển động của thiết bị.
- Kiểm thử thêm mốc 499/500/999/1.000/1.499/1.500, giới hạn/query bảng top, hiển thị top sau đăng nhập và loading khi API chờ/lỗi.

## Cập nhật typing / admin riêng / lưu kết quả gọn

- 35 kiểm thử tự động đã đạt: ngưỡng đúng 5/6 lỗi, số/dấu câu, kiểm tra backend, trang admin với 15 ô số cho ba độ khó, giới hạn hai kết quả và khóa quyền.
- Kiểm thử PostgreSQL xác nhận backfill không cộng trùng, heartbeat lặp không tăng thời gian, kết quả lặp không tăng thời gian, kỷ lục không bị kết quả thấp hơn thay thế và lượt cũ không ghi đè lượt mới.
- Đã áp dụng schema lưu gọn trên Supabase, đối chiếu tổng cũ/mới đều 4.178 giây, 8 bản tổng hợp học sinh/game.
- Dữ liệu legacy được giữ nguyên để tránh mất dữ liệu trong chuyển đổi; các lượt mới dùng hai slot kết quả và một hàng tạm tái sử dụng.

## Cập nhật database và backend

- 29/29 kiểm thử đã đạt trước khi push, gồm PostgreSQL/PGlite, phân quyền RLS, chống tự nâng quyền, cookie phiên, giới hạn đăng nhập, kiểm tra điểm/thời gian, giao diện đăng ký bằng PIN một ký tự và lưu màn/chỉ số riêng cho game bổ sung sau này.
- Supabase project: pjzsszjcymcfyamycidx (tipy-stem), Singapore.
- Đã áp dụng schema lên database thật và chạy truy vấn xác nhận game falling_letters tồn tại; RLS=true trên profiles/games/play_history.
- Đã tắt public Auth sign-up để đăng ký đi qua backend có giới hạn tần suất và tạo role student cố định.
- Đã sửa trigger theo thứ tự thực tế của Supabase Auth: hồ sơ luôn khởi tạo student; backend cấp admin riêng sau khi xác nhận mật khẩu khởi tạo, không phụ thuộc app_metadata trong INSERT trigger.
- Đã lưu khóa backend bằng biến Secret của Vercel Production; không commit giá trị.
- Thử đăng nhập và lưu kết quả trên bản triển khai thật được thực hiện sau khi deployment hoàn tất; các kiểm thử ở trên không tự chứng minh kết nối production.
- Đã xác minh production: admin đăng nhập/lưu cấu hình; học sinh đăng ký với PIN một ký tự và không có quyền quản trị; lượt thử lưu 10 điểm/8 giây/game_over; học sinh và admin đọc được lịch sử theo quyền; tài khoản thử bị khóa và đăng nhập bị từ chối.
- Đã xem Advisor Center. Giữ index phục vụ lịch sử và bảng giới hạn đăng nhập private chỉ cho server; không bật tính năng chống mật khẩu rò rỉ thuộc gói trả phí. Thu hồi quyền gọi hàm tự động bật RLS do Supabase tạo và tách policy đọc game để tránh policy chồng nhau.

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
