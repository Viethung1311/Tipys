# Hướng dẫn làm việc với TIPY STEM

TIPY STEM là website học tập có học sinh từ lớp 1 sử dụng. Các quy tắc dưới đây được chép từ Custom instructions của Project do chủ dự án cung cấp. Chúng áp dụng cho mọi lần sửa giao diện trong repository này.

## Trước khi thay đổi

- Đọc file này, `design-system/tipy/MASTER.md`, component và CSS của phần đang sửa; giữ nguyên các hướng dẫn kỹ thuật hiện có trong `ARCHITECTURE.md`, `BACKEND.md` và hướng dẫn ở thư mục con nếu có.
- `design-system/tipy/MASTER.md` là chuẩn thiết kế dùng chung. Khi thêm một kiểu mới, cập nhật chuẩn và component/token chung trong cùng thay đổi. Không tạo bảng màu hoặc kiểu nút riêng ở từng trang.
- Nếu có skill `ui-ux-pro-max`, dùng để hỗ trợ; quy tắc TIPY STEM được ưu tiên khi khác biệt. Không tự cài thêm skill hoặc thư viện lớn chỉ để chỉnh giao diện.
- Giữ nguyên chức năng, dữ liệu, phân quyền và luồng nghiệp vụ khi nhiệm vụ chỉ yêu cầu sửa giao diện. Các thay đổi tài khoản/lớp/ảnh private vẫn phải giữ kiểm tra quyền tại backend.

## 1. Định hướng chung

- Vui nhộn, thân thiện, gọn gàng, dễ hiểu với trẻ nhỏ; thao tác rõ ràng, ít chữ, chữ lớn và biểu tượng dễ nhận biết.
- Mỗi màn hình có một hành động chính nổi bật. Admin dành cho giáo viên có thể nhiều thông tin hơn nhưng vẫn cùng nhận diện.

## 2. Nút bấm

- Nút bo tròn, có chiều sâu nhẹ theo hai mẫu “Vào học” và “Chơi”; dùng component chung `TipyButton` cho các nút học sinh được chuẩn hóa.
- Nhãn thường 1–3 từ, động từ cụ thể: “Vào học”, “Chơi”, “Nộp bài”, “Xem bài”, “Làm lại”, “Quay lại”. Không rút ngắn làm mất nghĩa; hành động quan trọng phải rõ ràng.
- Nút chính học sinh luôn có chữ và biểu tượng đơn giản, không chỉ có biểu tượng.
- Nút chính cao tối thiểu 56 px, chữ khoảng 20–24 px đậm, đệm rộng. Vùng bấm khác tối thiểu 48 × 48 px, cách nhau đủ để tránh bấm nhầm.
- Có đủ trạng thái bình thường, nhấn, focus, đang xử lý và vô hiệu hóa. Nhấn lún nhẹ; không dùng chuyển động lặp hoặc gây phân tâm.

## 3. Màu sắc

- Cam: thương hiệu và hành động chính như “Vào học”. Xanh ngọc: hoạt động chơi. Nền trắng/trắng kem, chữ tối dễ đọc.
- Đỏ chỉ cho lỗi hoặc xóa, không trang trí nút thông thường. Mỗi màu có vai trò nhất quán giữa các trang.
- Bảo đảm tương phản: nếu chữ trắng trên cam khó đọc, đổi sắc độ nền hoặc dùng chữ tối. Trạng thái phải có chữ/biểu tượng, không chỉ khác màu.

## 4. Chữ và biểu tượng

- Một font chính nét tròn, vui nhưng dễ đọc, đủ dấu tiếng Việt; kiểm tra dấu trước khi áp dụng. Không dùng font trang trí cho nội dung/hướng dẫn.
- Chữ nội dung học sinh khoảng 18–20 px, tiêu đề khoảng 28–36 px; điều chỉnh trên điện thoại. Dùng chữ theo câu (“Vào học”), không viết hoa các đoạn dài.
- Dùng SVG từ thư viện Lucide hiện có, cùng phong cách và độ dày nét.

## 5. Bố cục và phản hồi

- Khoảng trắng rộng, thẻ bo tròn, phân cấp rõ; điện thoại ưu tiên một cột, nút dễ chạm.
- Mỗi thẻ chỉ chứa thông tin cần thiết; đưa chi tiết sang trang riêng. Hướng dẫn ngắn, từ quen thuộc, mỗi câu một việc.
- Luôn phản hồi rõ sau thao tác: đã nộp, đang tải, chưa có bài, hoặc cần thử lại.
- Không cắt chữ, che dấu tiếng Việt hoặc tạo thanh cuộn ngang ngoài ý muốn.

## 6. Triển khai thống nhất

- Dùng token/biến CSS chung cho màu, font, khoảng cách, bo góc và bóng đổ; xem `src/styles/tipy-tokens.css`.
- Tạo hoặc tái sử dụng component chung cho nút, thẻ, ô nhập và trạng thái; các trang gọi component, không sao chép CSS riêng.
- Không thay hàng loạt màn hình ngoài phạm vi được yêu cầu. Bản thử đầu tiên chỉ áp dụng nút chung cho “Vào học” trên trang chủ và “Chơi” trong kho trò chơi.
- Giữ các tối ưu hiện có: code splitting, cache theo tài khoản, phân trang bài viết, ảnh lazy và quyền Storage private. Không thêm animation lặp cho nút.

## 7. Kiểm tra trước khi hoàn thành

- Kiểm tra điện thoại và máy tính, chữ/dấu tiếng Việt, tương phản, kích thước vùng bấm và khoảng cách.
- Kiểm tra Tab/Enter/Space và focus rõ; tôn trọng `prefers-reduced-motion`.
- Kiểm tra bình thường, nhấn, disabled, loading; các màn hình có tải, trống, lỗi và thành công phải phản hồi đúng.
- Chạy build và test liên quan. Báo ngắn gọn phần đã thay đổi, phần đã xác minh và phần chưa kiểm tra được.

## Mở rộng nút học sinh

TipyButton được dùng cho CTA trang chủ, kho game, bắt đầu/chơi lại/tiếp tục, đổi cài đặt, xác nhận âm thanh, lưu nhân vật và đăng nhập/đăng ký/đăng xuất. Giữ nguyên callback, điều kiện disabled và type submit của form. Nút quản trị, chọn phím, switch và bộ lọc không nằm trong đợt này.

Component nhận icon là component Lucide (mặc định Rocket hoặc Gamepad2 theo variant) và emphasis="secondary" cho hành động phụ. Kiểu phụ dùng nền trắng/kem, chữ và viền theo màu vai trò hiện có; không thêm bảng màu. Loading vẫn chặn thao tác, aria-busy và nhãn rõ. Đặt khoảng cách tối thiểu 12 px giữa các CTA trong dialog và cho hàng bắt đầu game tự xuống dòng ở màn hẹp.
