# Hướng dẫn làm việc với Zunimo

Thương hiệu hiển thị là Zunimo. Các tên kỹ thuật `tipy`, `TipyButton`, token/font CSS, cookie, API, bucket và đường dẫn `design-system/tipy` được giữ để tương thích. Không đổi tên miền khi chủ dự án chưa yêu cầu.

Header dùng nhóm tài khoản cố định bên phải, không phụ thuộc mục Lớp học. Tiền thưởng hiển thị là Sao của bạn: gồm sao bài học (chỉ cộng phần tăng thêm, tối đa 3 sao/bài), thưởng tuần và sao giáo viên tặng; không cộng điểm game hoặc quy đổi điểm cũ. Xem quy tắc trong MASTER.md, db/stars.sql, db/lesson_star_upgrades.sql và db/student_actions.sql. Học sinh không được tự cộng sao.

Zunimo là website học tập có học sinh từ lớp 1 sử dụng. Các quy tắc dưới đây được chép từ Custom instructions của Project do chủ dự án cung cấp. Chúng áp dụng cho mọi lần sửa giao diện trong repository này.

## Trước khi thay đổi

- Đọc file này, `design-system/tipy/MASTER.md`, component và CSS của phần đang sửa; giữ nguyên các hướng dẫn kỹ thuật hiện có trong `ARCHITECTURE.md`, `BACKEND.md` và hướng dẫn ở thư mục con nếu có.
- `design-system/tipy/MASTER.md` là chuẩn thiết kế dùng chung. Khi thêm một kiểu mới, cập nhật chuẩn và component/token chung trong cùng thay đổi. Không tạo bảng màu hoặc kiểu nút riêng ở từng trang.
- Nếu có skill `ui-ux-pro-max`, dùng để hỗ trợ; quy tắc Zunimo được ưu tiên khi khác biệt. Không tự cài thêm skill hoặc thư viện lớn chỉ để chỉnh giao diện.
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

## Phạm vi chuẩn hóa toàn website

Bài kiểm tra dùng module `src/features/assessments`, SQL `db/assessments.sql` và tài khoản/lớp hiện có. Chỉ backend chấm và ghi kết quả riêng; adapter của hai engine không được gọi endpoint luyện tập, cộng sao hoặc bảng tuần. Đề đã gửi là snapshot không sửa; quyền lớp được kiểm tra lại ở mỗi lần đọc/ghi. Dùng database/tài khoản thử, không gửi đề thử cho lớp thật. Giao theo lớp dùng assessment_class_targets và thành viên hiện tại, kể cả bạn vào sau; không suy nguồn nhận từ tên hiển thị. Xóa bài là xóa vĩnh viễn bằng xác nhận accept ở cả UI/backend; chỉ xóa dữ liệu riêng bài, không tự xóa bài thật để thử.

Đợt chuẩn hóa tiếp theo đã mở rộng ra toàn bộ website theo yêu cầu chủ dự án. Dùng `src/styles/tipy-ui.css` cùng token chung, giữ bố cục gameplay ở feature riêng. TipyButton dùng cả cho quản trị và các thao tác lớp/file; quản trị kế thừa bộ token nút gọn 48 px, học sinh giữ nút chính 64 px. Chi tiết và kiểm tra được ghi trong MASTER.md. Lịch sử chơi được đặt riêng trong quản trị; không thêm lại tab này vào Tài khoản/Nhân vật.

## Tự chọn công cụ khi làm việc với code

Áp dụng cả khi người dùng giao việc bằng tiếng Việt bình thường, không gọi tên skill. Yêu cầu trực tiếp của người dùng và hướng dẫn riêng của dự án được ưu tiên hơn skill.

### Ponytail — mặc định full

- Trước khi làm việc với code, đọc skill Ponytail của repository: `.agents/skills/ponytail/SKILL.md`; nếu thiếu, dùng `C:/Users/boof1/.agents/skills/ponytail/SKILL.md` ở cấp người dùng. Áp dụng mức **full**; nếu người dùng tắt hoặc đổi mức, làm theo trong phiên đó.
- Chọn thay đổi nhỏ nhất giải quyết đầy đủ yêu cầu; tái sử dụng component, helper, API và quy ước hiện có. Xác định nơi sử dụng và ảnh hưởng trước khi sửa, xử lý nguyên nhân chung và kiểm tra đúng phạm vi thay đổi.
- Giữ đầy đủ kiểm tra dữ liệu, phân quyền, xử lý lỗi và khả năng truy cập; viết code dễ đọc. Không thêm thư viện hoặc lớp trừu tượng khi không cần.

### Graphify — khi cần hiểu nhiều file

- Đọc `.codex/skills/graphify/SKILL.md` hiện có; nếu vị trí cài thay đổi, kiểm tra `.agents/skills/graphify/SKILL.md`. Tự dùng khi lần theo frontend → API → database, tìm request lặp, tìm nơi sử dụng hàm hoặc đánh giá ảnh hưởng qua nhiều file. Với việc nhỏ đã biết vị trí (ví dụ đổi nhãn nút), mở trực tiếp file liên quan.
- Bắt đầu bằng `graphify query "<từ khóa>" --budget 1500`; chuyển câu hỏi tiếng Việt thành từ khóa trong code (ví dụ bài kiểm tra → `assessment`). Mở rộng khi cần; dùng `graphify path "<A>" "<B>"` hoặc `graphify explain "<concept>"` để lần quan hệ. Đối chiếu kết quả với mã nguồn trước khi sửa; đồ thị không chứng minh được số request thực tế lúc chạy.
- Dùng lại `graphify-out/` giữa các phiên. Trước khi dựa vào đồ thị, kiểm tra manifest/trạng thái build và các file liên quan đã đổi từ lần tạo gần nhất; không chỉ dựa vào thời gian của `graph.json`. Chạy `graphify update .` khi tạo lần đầu hoặc khi file liên quan thay đổi, kể cả sau khi sửa code. File đồ thị chưa commit không phải lý do bỏ qua công cụ.
- Nếu thiếu lệnh hoặc đồ thị lỗi, thông báo ngắn và tiếp tục bằng `rg` cùng mã nguồn; không tự cài lại công cụ. Dùng wiki nếu có để điều hướng rộng; chỉ đọc `graphify-out/GRAPH_REPORT.md` khi cần tổng quan hoặc truy vấn hẹp chưa đủ.
- Graphify chỉ là công cụ phát triển: không thêm vào mã chạy website, dependency runtime hay build Vercel. Giữ đồ thị để tái sử dụng; không tạo lại toàn bộ nếu cập nhật tăng dần đủ dùng.
