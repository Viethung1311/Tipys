# TIPY STEM · Vườn phím nhỏ

Web luyện bàn phím tiếng Việt bằng React + Vite, Tailwind CSS, Radix Dialog và Lucide. Có backend Vercel + Supabase cho tài khoản học sinh, quản trị và lịch sử; khách vẫn có thể chơi thử không cần đăng nhập.

Chơi trực tuyến: https://tipys.vercel.app

Mã nguồn: https://github.com/Viethung1311/Tipys

## Chạy dự án

Yêu cầu Node.js 22.12+ hoặc 24.

```sh
npm ci
npm run dev
```

Mở địa chỉ Local do Vite hiển thị. Để điện thoại chơi cùng mạng Wi-Fi, mở địa chỉ Network do Vite hiển thị (máy tính phải cho phép kết nối mạng nội bộ).

## Kiểm tra và build

```sh
npm run build
npm test
npm run preview
node scripts/standalone.mjs
```

Lệnh cuối tạo một file HTML độc lập ở thư mục cha, có thể mở trực tiếp để chơi mà không cần cài Node.js. File này chứa toàn bộ mã và giao diện, không tải thư viện từ mạng.

## Luật chơi

- Ba mạng, mỗi chữ đúng +10 điểm; sai lần thứ 6 kết thúc lượt dù còn mạng.
- Chữ chạm đáy mất một mạng; hết mạng hiện kết quả.
- Phím trùng nhau: ưu tiên chữ thấp nhất. Giữ phím không được tính lặp.
- Ba độ khó tăng dần mỗi 20 giây, có giới hạn tốc độ và số chữ.
- Bộ 4/6/8/A–Z, số, dấu câu hoặc tự chọn; hỗ trợ thêm 0–9 và ; ' , . /.
- Bàn phím vật lý đọc KeyboardEvent.code; bàn phím cảm ứng cho điện thoại.
- Esc/nút tạm dừng; tự dừng khi chuyển tab, mất tiêu điểm hoặc đổi kích thước cửa sổ.
- Lưu cài đặt, âm thanh và kỷ lục riêng theo độ khó + bộ phím bằng localStorage. Kỷ lục chỉ thuộc trình duyệt này.

## Âm thanh

Mở nút **Âm thanh** ở góc trên để bật/tắt và chỉnh âm lượng độc lập cho **Hiệu ứng** và **Nhạc nền**. Hiệu ứng bật sẵn (55%), nhạc nền tắt sẵn (âm lượng khi bật là 25%). Tùy chọn được lưu trong trình duyệt; lựa chọn tắt âm từ bản cũ được giữ lại.

Hiệu ứng gồm click mềm, tick chọn/bỏ phím, ba tiếng đếm ngược, tiếng bắt đầu, pop khi gõ đúng, tiếng sai nhẹ hơn, mất mạng, tăng tốc, ba nốt kết thúc và giai điệu kỷ lục mới. Nhạc nền là giai điệu tổng hợp không lời, chỉ phát lúc đang chơi. Tạm dừng, mở cài đặt, đổi tab hoặc rời màn chơi sẽ dừng nhạc. Giới hạn tối đa bốn nhóm hiệu ứng đồng thời và chặn âm bấm quá dày; nhiều chữ rơi chạm đáy trong cùng khung hình chỉ phát một âm mất mạng.

Toàn bộ âm được tạo bằng Web Audio, không tải file âm thanh bên ngoài. Trình duyệt cần một thao tác bấm hoặc gõ đầu tiên để cho phép phát âm. Trò chơi vẫn chạy khi trình duyệt không hỗ trợ Web Audio.

## Triển khai

Đã có vercel.json: framework Vite, build `npm run build && npm test`, output dist. Chỉ hoàn tất deployment khi build và kiểm thử thành công.
Đưa mã lên kho GitHub của bạn, import kho đó vào Vercel và chọn Deploy. Không cần biến môi trường.

## Cấu trúc

- src/App.jsx: luồng trang chủ, cài đặt, màn chơi và hộp thoại.
- src/components/Keyboard.jsx: chọn phím và bàn phím cảm ứng.
- src/hooks/useFallingGame.js: vòng lặp duy nhất và sự kiện bàn phím.
- src/game/config.js: cấu hình và lưu trình duyệt.
- src/game/engine.js: luật chơi độc lập, kiểm thử bằng Node.
- src/game/audio.js và src/hooks/useGameAudio.js: tổng hợp âm, giới hạn âm chồng, nhạc nền và lưu tùy chọn.
- tests/: kiểm thử logic và tương tác ứng dụng.

Hướng dẫn database, biến môi trường, phân quyền và thêm game: xem [BACKEND.md](BACKEND.md). Chưa có bảng xếp hạng công khai. Bản HTML độc lập chỉ hỗ trợ chơi khách, không dùng tính năng tài khoản.

Trang admin riêng: https://tipys.vercel.app/admin. Có chỉnh tốc độ từng độ khó và xem tổng thời gian luyện của học sinh. Kết quả chỉ giữ cao nhất và gần nhất trên mỗi học sinh/game; tổng thời gian vẫn cộng dồn.
