# TIPY STEM · Vườn phím nhỏ

Web luyện bàn phím tiếng Việt bằng React + Vite, Tailwind CSS, Radix Dialog và Lucide. Không cần backend hoặc tài khoản.

## Chạy dự án

Yêu cầu Node.js 22.12+ hoặc 24.

```sh
npm ci
npm run dev
```

Mở địa chỉ Local do Vite hiển thị. Để điện thoại chơi cùng mạng Wi-Fi, mở địa chỉ Network do Vite hiển thị (máy tính phải cho phép kết nối mạng nội bộ).

## Kiểm tra và build

```sh
npm test
npm run build
npm run preview
node scripts/standalone.mjs
```

Lệnh cuối tạo một file HTML độc lập ở thư mục cha, có thể mở trực tiếp để chơi mà không cần cài Node.js. File này chứa toàn bộ mã và giao diện, không tải thư viện từ mạng.

## Luật chơi

- Ba mạng, mỗi chữ đúng +10 điểm; sai không mất mạng.
- Chữ chạm đáy mất một mạng; hết mạng hiện kết quả.
- Phím trùng nhau: ưu tiên chữ thấp nhất. Giữ phím không được tính lặp.
- Ba độ khó tăng dần mỗi 20 giây, có giới hạn tốc độ và số chữ.
- Bộ 4/6/8/A–Z hoặc tự chọn; túi phím xáo trộn giúp luyện đều.
- Bàn phím vật lý đọc KeyboardEvent.code; bàn phím cảm ứng cho điện thoại.
- Esc/nút tạm dừng; tự dừng khi chuyển tab, mất tiêu điểm hoặc đổi kích thước cửa sổ.
- Lưu cài đặt, âm thanh và kỷ lục riêng theo độ khó + bộ phím bằng localStorage. Kỷ lục chỉ thuộc trình duyệt này.

## Triển khai

Đã có vercel.json: framework Vite, build npm run build, output dist.
Đưa mã lên kho GitHub của bạn, import kho đó vào Vercel và chọn Deploy. Không cần biến môi trường.

## Cấu trúc

- src/App.jsx: luồng trang chủ, cài đặt, màn chơi và hộp thoại.
- src/components/Keyboard.jsx: chọn phím và bàn phím cảm ứng.
- src/hooks/useFallingGame.js: vòng lặp duy nhất và sự kiện bàn phím.
- src/game/config.js: cấu hình và lưu trình duyệt.
- src/game/engine.js: luật chơi độc lập, kiểm thử bằng Node.
- tests/: kiểm thử logic và tương tác ứng dụng.

Chưa có đăng nhập, đồng bộ dữ liệu hoặc bảng xếp hạng trực tuyến theo đúng phạm vi bản đầu.
