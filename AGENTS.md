# Hướng dẫn làm việc với Zunimo

Zunimo là website học tập cho học sinh từ lớp 1. Giữ các định danh kỹ thuật `tipy`, `TipyButton`, font CSS `TIPY Nunito`, API, cookie, bucket và đường dẫn `design-system/tipy` để tương thích. Không đổi tên miền khi chưa được yêu cầu.

## Nguồn chuẩn và cách làm

- Trước khi sửa, đọc `design-system/tipy/MASTER.md`, component/CSS liên quan, `ARCHITECTURE.md`, `BACKEND.md` và hướng dẫn thư mục con nếu có. MASTER là quy chuẩn giao diện chung; màu, chữ, kích thước, bố cục và ánh xạ code nằm ở đó, không lặp tại đây.
- [Figma Zunimo](https://www.figma.com/design/DOldfpt6VKk7O77fkXM1QN) là nguồn tham chiếu thiết kế. Trước khi sửa một phần, đọc đúng màn, component và trạng thái bằng dữ liệu thiết kế cùng ảnh chụp; không coi mockup là quy tắc backend.
- Giữ nguyên font hiện tại của website. Giao diện sáng, phối màu theo chức năng nhưng thống nhất; khung nội dung lớn, rõ, có khoảng thở; chữ tiếng Việt dễ đọc và hành động cụ thể, ít chữ thừa.
- Dùng token/component chung. Khi cần kiểu mới, cập nhật MASTER và primitive dùng chung trong cùng thay đổi triển khai, rồi để các trang tái sử dụng. Không chép màu/kích thước/nút riêng rải rác, không thêm thư viện lớn chỉ để chỉnh giao diện. Nếu có `ui-ux-pro-max`, có thể dùng hỗ trợ; quy tắc Zunimo được ưu tiên.
- Khi Figma bị chặn hoặc thiếu trạng thái, báo rõ giới hạn trước khi suy ra chuẩn. Chỉ ghi giá trị có nguồn; tách thông số Figma đã kiểm chứng, hiện trạng code và đề xuất kế thừa. Không tuyên bố đã xem màn chưa đọc được hoặc tự lấy kích thước từ ảnh co nhỏ làm số đo thiết kế.
- Yêu cầu trực tiếp của chủ dự án được ưu tiên. Sửa tài liệu chuẩn không đồng nghĩa tự đổi giao diện, nghiệp vụ hoặc triển khai production. Không mở rộng sang các màn ngoài phạm vi được giao.

## Dữ liệu và phân quyền phải giữ

- Giữ chức năng, dữ liệu và luồng nghiệp vụ khi chỉ sửa giao diện. Vai trò tin cậy lấy từ `profiles` ở backend: `student`, `teacher`, `admin`; kiểm tra quyền hiện tại tại API/RPC/RLS/Storage, kể cả truy cập tệp. Khóa đặc quyền chỉ ở backend; không nâng giáo viên thành Admin để dùng lại chức năng.
- Chỉ Admin tạo/khóa giáo viên, phân công qua `class_teachers` và quản trị tài khoản/lớp/game/reset. Giáo viên chỉ làm việc trong lớp được giao, quản lý bài đăng/bài kiểm tra của mình, xem kết quả, cộng/trừ sao và loại thành viên theo quyền hiện có. Loại bằng `accept` chỉ bỏ quan hệ của lớp được chọn, giữ tài khoản, lịch sử và lớp khác. Chủ dự án đã chọn chỉ tặng sao, chưa thêm điểm tặng.
- **Sao của bạn** là số dư từ ledger: sao bài học chỉ cộng phần tăng thêm, tối đa 3 sao/bài, cộng sao tặng và thưởng tuần, trừ các tác động reset/trừ hợp lệ. Không cộng điểm game/quy đổi điểm cũ; học sinh không tự cộng sao. Bảng **Sao trong lớp tuần này** tính riêng theo nguồn lớp và tuần Việt Nam, không lấy tổng sao tài khoản. Quy tắc đầy đủ nằm trong MASTER và SQL/backend.
- Kiểm tra dùng `src/features/assessments` và SQL hiện có. Chỉ backend chấm/lưu kết quả; adapter không gọi endpoint luyện tập, cấp sao hoặc ghi bảng tuần. Đề đã gửi là snapshot bất biến; giao theo lớp dùng `assessment_class_targets` và thành viên hiện tại, kể cả học sinh vào sau, không suy từ tên hiển thị. Xóa bài vĩnh viễn cần đúng `accept` ở UI/backend, chỉ tác động dữ liệu riêng bài đó.
- Không dùng tài khoản/lớp thật để tặng/trừ/reset sao, gửi đề hoặc xóa thử. Giữ kiểm tra dữ liệu, xử lý lỗi, chống gửi trùng và tính nhất quán database. Xem `db/teacher_roles.sql`, `db/classroom_hub.sql`, `db/stars.sql`, `db/lesson_star_upgrades.sql`, `db/student_actions.sql` và `BACKEND.md`.

## Hiệu năng và trạng thái

- Giữ lazy loading, ảnh lazy, phân trang/lọc/sắp xếp/tổng hợp ở backend, cache theo tài khoản/lớp/tab/trang và chia sẻ request đang chạy. Đổi tài khoản phải xóa cache riêng và bỏ phản hồi phiên cũ; đổi lớp bỏ phản hồi lớp trước.
- Lớp học dùng trang lazy `/classroom?class=<id>&tab=members|notifications|tests|messages`, khung theo visual viewport và cuộn nội bộ. Tổng quan tải 24 thành viên/trang cùng Top 3; tab khác chỉ tải khi cần. Quản trị học sinh/kết quả vẫn giữ phân trang 7 hàng theo luồng hiện có.
- Mở/đóng menu, hộp thoại đã tải, fullscreen và tạm dừng chỉ đổi UI; không tạo request ghi, không dựng lại engine. Không polling liên tục hay truy vấn theo từng hàng. Sau thao tác chỉ cập nhật phần/cache liên quan; dọn listener, timer và kết nối khi đổi phạm vi hoặc rời trang.
- Giữ lịch, số lượt, thời gian máy chủ, lưu bản nháp và tự chốt bài theo luật hiện tại; không thêm bước nộp thủ công hoặc checkpoint dày trở lại vì mockup. Không báo thành công trước xác nhận backend.

## Kiểm tra và bàn giao

- Với UI: kiểm tra máy tính/điện thoại, xoay màn hình, vùng nhìn khi bàn phím mở, dấu tiếng Việt, tương phản, vùng bấm, cuộn nội bộ và các trạng thái tải/trống/lỗi/thành công. Kiểm tra Tab/Enter/Space, Esc, focus, nhãn truy cập và `prefers-reduced-motion`.
- Chạy build/test đúng phạm vi thay đổi. Với tài liệu thuần túy, kiểm tra định dạng, đường dẫn, số liệu và mâu thuẫn giữa hai tài liệu; không bắt buộc build/test gameplay khi code không đổi.
- Báo ngắn phần đã sửa, nguồn Figma đã đối chiếu, kiểm tra đã chạy, phần chưa xác minh và trạng thái triển khai. Không tự commit/push/deploy khi yêu cầu chỉ sửa tài liệu.

## Tự chọn công cụ

Áp dụng cả khi giao việc bằng tiếng Việt, không gọi tên skill. Yêu cầu trực tiếp và hướng dẫn riêng của dự án được ưu tiên hơn skill.

### Ponytail — mặc định full

- Đọc `.agents/skills/ponytail/SKILL.md`; nếu thiếu, dùng `C:/Users/boof1/.agents/skills/ponytail/SKILL.md`. Áp dụng **full**, trừ khi người dùng tắt hoặc đổi mức trong phiên.
- Chọn thay đổi nhỏ nhất giải quyết đầy đủ yêu cầu. Xác định nơi sử dụng/ảnh hưởng, xử lý nguyên nhân chung, tái sử dụng component/helper/API/quy ước hiện có; giữ validation, quyền, xử lý lỗi và khả năng truy cập. Không thêm thư viện hoặc lớp trừu tượng không cần thiết.

### Graphify — khi cần hiểu nhiều file

- Kiểm tra trước bằng `npm run graphify -- setup`. Dùng launcher `scripts/graphify.mjs`, môi trường `.tools/graphify` và phiên bản trong `scripts/graphify-requirements.txt`, không phụ thuộc alias Python hoặc lệnh toàn cục. Nếu thiếu/lỗi, báo nguyên nhân và cách sửa trước, rồi tự cài/sửa trong phạm vi dự án theo ủy quyền hiện có; không hỏi lại. Chỉ xác nhận hoạt động sau một truy vấn thành công.
- Đọc `.codex/skills/graphify/SKILL.md`; nếu vị trí đổi, kiểm tra `.agents/skills/graphify/SKILL.md`. Dùng khi lần frontend → API → database, tìm request lặp/nơi dùng hàm hoặc đánh giá ảnh hưởng nhiều file. Việc nhỏ đã biết vị trí thì mở file trực tiếp.
- Bắt đầu `npm run graphify -- query "<từ khóa>" --budget 1500`; đổi câu hỏi tiếng Việt sang thuật ngữ code, ví dụ bài kiểm tra → `assessment`. Nếu trùng tên, dùng đường dẫn/symbol hoặc `--seed <node-id>`; thu hẹp trước, mở rộng khi cần, dùng `path`/`explain` qua launcher. Đối chiếu mã nguồn trước khi sửa; đồ thị không chứng minh số request thực tế.
- Tái sử dụng `graphify-out/`. Trước khi dựa vào đồ thị, kiểm tra manifest/trạng thái build và file liên quan đã đổi, không chỉ mtime của `graph.json`. Chạy `npm run graphify -- update .` khi tạo lần đầu hoặc nguồn liên quan đã đổi; kiểm tra log/kết quả, không coi quét 0 file là thành công. Launcher chuẩn hóa đường dẫn Windows; đồ thị chưa commit không phải lý do bỏ qua công cụ.
- Nếu vẫn lỗi sau sửa, nói rõ rồi dùng `rg`/mã nguồn để tiếp tục. Dùng wiki để điều hướng rộng; chỉ đọc `graphify-out/GRAPH_REPORT.md` khi cần tổng quan hoặc truy vấn hẹp chưa đủ. Cảnh báo sandbox Windows `Failed to find real location ... python.exe` không tự chứng minh lệnh hỏng: kiểm tra mã thoát và kết quả, không cài lại chỉ vì cảnh báo đó.
- Graphify chỉ dùng khi phát triển; không thêm vào runtime website, dependency runtime hoặc build Vercel, không tạo lại toàn bộ khi cập nhật tăng dần đủ dùng.
