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

## Loader phím vàng và hiệu ứng bảng top

- Loader phím chữ vàng bo góc theo ảnh tham khảo, nhún lệch nhịp và bóng co giãn theo mẫu mobinkakei/Uiverse; ghi nhận giấy phép MIT trong THIRD_PARTY_NOTICES.md.
- Bảng top hiện dần một lần khi IntersectionObserver báo đã cuộn tới, từng dòng lệch nhịp; trình duyệt không hỗ trợ observer vẫn hiện bảng.
- Tắt animation với prefers-reduced-motion. 39/39 kiểm thử đạt, gồm trigger reveal và đủ 10 phím chữ/1 khoảng cách trong loader.

## Portal, lớp học và sắp xếp mã

- 44/44 kiểm thử đạt sau build; kiểm tra định dạng toàn bộ src/server/api/tests/scripts cũng đạt.
- PGlite kiểm tra RLS người ngoài lớp/thành viên, chặn học sinh ghi bảng hoặc gọi RPC đăng bài, upload chưa hoàn tất không tạo bài, bài và liên kết file được ghi nguyên tử, xóa mềm/khôi phục giữ dữ liệu.
- UI kiểm tra nav khách không vào lớp, học sinh được thêm nhìn thấy lớp/bàn học/bài/link và đổi nhân vật của riêng mình. Bộ test game, âm thanh và kết quả trước đây vẫn đạt sau refactor.
- Supabase xác nhận `Success. No rows returned` khi áp dụng `db/classrooms.sql` ngày 09/11/2026; phiên bản cuối không có DROP/DELETE/TRUNCATE.
- Tách game/setup/home/audio và các service identity/games/classrooms/validation; thêm ARCHITECTURE.md, comment tại ranh giới và lệnh format/format:check.

## Xác minh production sau triển khai portal

- Vercel production commit `5feebe280552282c78c4dc1ac69277ff2be9a88d` đã thành công.
- Admin tạo lớp thử, đăng bài kèm TXT/link và bài kèm PNG trên web thật. API trả liên kết file riêng, ảnh PNG tải thành công (naturalWidth=77), không có thông báo lỗi ở luồng gửi/mở file.
- Đã lưu trữ → khôi phục lớp và xác nhận còn 2 bài; sau đó lưu trữ lớp thử lần nữa. Không thêm tài khoản học sinh thật vào lớp thử.
- Viewport 390 × 844: nav và lớp không tràn ngang (document.scrollWidth=375, innerWidth=390). Ảnh bằng chứng ở thư mục outputs của workspace.
- Các kiểm thử tự động đã xác nhận sơ đồ lớp, lưu con giáp, ngăn người ngoài lớp, ghi bài nguyên tử và phục hồi membership. Chưa kiểm tra đăng nhập học sinh bằng trình duyệt ở lượt này: tài khoản synthetic cũ đang bị khóa; xét duyệt tự động từ chối mở khóa vì chưa có cho phép riêng cho thay đổi trạng thái. Trạng thái khóa được giữ nguyên.
- Đã đăng xuất admin, đưa portal về trang chủ và khôi phục viewport mặc định.

## Tách trang giới thiệu và kho game

- Build thành công; 45 kiểm thử đạt. Luồng game vẫn chạy qua kho → thiết lập → chơi → kết quả.
- Test UI xác nhận Trang chủ có Scratch và địa chỉ, không render game-card/bảng top. Test catalog xác nhận game inactive bị ẩn và engine chưa đăng ký không được chạy.
- Top, kiểm tra reveal và luồng tài khoản được kiểm tra tại kho game mới; các test lớp học và lưu dữ liệu vẫn đạt.

## Thành viên lớp theo lô

- 49/49 kiểm thử đạt. Bulk UI xác nhận hai học sinh được thêm bằng đúng một yêu cầu, bỏ một học sinh bằng một yêu cầu, không reload bootstrap/history/students sau thao tác; hai lớp trùng tên vẫn giữ đúng quan hệ theo ID.
- Bộ lọc/tìm kiếm và chọn tất cả chỉ chọn hàng hiển thị. Khi lỗi mạng, checkbox và nội dung tìm kiếm không mất. Gửi nhanh hai lần không tạo hai yêu cầu.
- Backend chặn non-admin, ID không hợp lệ/trùng/quá 200 và danh sách có tài khoản không phù hợp trước khi ghi; thêm/bỏ cả danh sách dùng một upsert, không xóa tài khoản.

## Sửa dialog và Trang chủ có ảnh Scratch

- 50/50 kiểm thử đạt; build và format:check thành công. Test mới mô phỏng bàn phím ảo thay đổi viewport từ 844 xuống 320 px, offset 52 px, đổi sang ngang, đóng hộp và kiểm tra listener đã được gỡ cho cả tài khoản/âm thanh.
- Sửa nguyên nhân animation screen-enter ghi đè transform căn giữa modal ở môi trường bật chuyển động. Bỏ transform định vị, dùng grid wrapper với animation panel riêng.
- Tách trigger tài khoản khỏi selector sound-button; nav dạng grid, giữ nhãn tài khoản dài bằng ellipsis, ô nhập 16 px và các nút thao tác tối thiểu 44 px.
- Trang chủ dùng 3 ảnh Scratch của người dùng và fade/stagger tiêu đề → ảnh → nút. Giữ kích thước ảnh, tôn trọng reduced motion, dọn CSS minh họa cũ.

### Đo bố cục production

- Đã đo 18 trường hợp dialog trên trình duyệt thật ở viewport 320×568, 375×667, 390×844, 768×1024, 1024×768, 1440×900 và 844×390. Các hộp nằm trọn vùng nhìn thấy, lệch tâm đo được 0 px, ô đăng nhập/đăng ký đều 16 px; hộp thấp có cuộn nội bộ.
- Bổ sung gate hero-ready sau khi bootstrap/loading kết thúc; kiểm thử loading xác nhận không chạy sớm và mở lại khi cả API thành công hoặc lỗi. Nút switch âm thanh có vùng bấm 48×44 px, track giữ chiều cao 28 px.
- Kiểm tra theo kích thước mô phỏng không thay cho thử trên toàn bộ thiết bị/trình duyệt vật lý.

## Thiết kế lớp theo bản vẽ 10/11/2026

- Build và 53/53 test đạt. UI xác nhận một ô/một thành viên, học sinh thấy bài đã đăng nhưng không thấy editor/preview, chọn 12 con giáp trong Account và lưu cập nhật ngay ô cá nhân.
- Top lớp chỉ chứa thành viên của lớp được phép đọc; không dùng điểm các game khác làm điểm typing; giữ tổng thời gian luyện. GET leaderboard cũ trả 404 cho cả user đã đăng nhập.
- Test preview giáo viên xác nhận text HTML được escape, link javascript không tạo anchor, file/ảnh chỉ preview local trước khi Đăng và object URL được revoke.
- Avatar API dùng ID phiên đăng nhập, bỏ qua ID giả từ client và hoạt động khi tài khoản chưa được thêm vào lớp.

### Kiểm thử chuyển lớp

- Sửa trùng key giữa lưới và composer gây giữ DOM lớp cũ. Regression test đổi A → B → A → B xác nhận luôn đúng một lưới, một Top và một composer; ghi nhận cả cảnh báo console React.
- Chặn refresh/phân trang cũ cập nhật nhầm lớp mới; gắn override avatar với đúng user_id để phản hồi cũ không hiển thị cho tài khoản khác.
