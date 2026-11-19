# Zunimo — chuẩn giao diện dùng chung

## 1. Nguồn chuẩn và mức xác minh

[Figma Zunimo · Lớp học & Luyện gõ](https://www.figma.com/design/DOldfpt6VKk7O77fkXM1QN) là nguồn tham chiếu thiết kế chung. Giữ font hiện tại, định danh kỹ thuật và luật backend. Mọi đường dẫn code dưới đây tính từ gốc repository.

- **F — Figma đã xác minh trước đây:** giá trị đã ghi thành công vào file và/hoặc đối chiếu qua ảnh trả về trong phiên dựng ngày **19/11/2026**. Đây là bằng chứng lịch sử, không xác nhận file hiện tại chưa đổi.
- **W — Website đã đọc:** giá trị/hành vi đang có trong token, component, CSS; không tự gắn nhãn Figma.
- **K — Kế thừa/đề xuất:** cách triển khai cho khoảng trống thiết kế, chờ đối chiếu Figma trước khi coi là số đã chốt.

**Giới hạn ngày 20/11/2026:** đọc lại metadata bị chặn bởi hạn mức MCP Starter/View; chưa đọc lại từng màn, component, trạng thái hoặc ảnh mới. Lần cập nhật này không suy ra dữ liệu thiết kế mới. Để xác minh mới nhất cần hạn mức được làm mới, Professional với Full seat, hoặc bản xuất thông số/component và ảnh tương ứng do chủ dự án cung cấp.

| Đối tượng F               | Nguồn trong file                                                           | Bằng chứng hiện có                                                 |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Nền tảng/component        | Trang `0:1`, Tham khảo + Thành phần                                        | Đã tạo biến màu/spacing/radius và variants; chưa audit lại toàn bộ |
| Tổng quan máy tính        | [7:185](https://www.figma.com/design/DOldfpt6VKk7O77fkXM1QN?node-id=7-185) | 1440 × 900, đã xem ảnh                                             |
| Tổng quan điện thoại      | [7:348](https://www.figma.com/design/DOldfpt6VKk7O77fkXM1QN?node-id=7-348) | 390 × 844, đã xem ảnh                                              |
| Hộp thoại sao/loại        | [5:77](https://www.figma.com/design/DOldfpt6VKk7O77fkXM1QN?node-id=5-77)   | Đã xem Gift, Deduct, DeductError, Remove, RemoveReady              |
| Màn còn lại               | Trang Máy tính `2:2`                                                       | Đã tạo 33 frame, có ID/kích thước trả về; chưa xem ảnh từng frame  |
| Mobile chi tiết/prototype | Trang Điện thoại `2:3`                                                     | Mới có tổng quan; các màn chi tiết và prototype chưa hoàn tất      |

Không coi file đang hoàn thiện là đã nghiệm thu. Trước khi triển khai phải đọc đúng node/trạng thái. Ảnh chụp gốc chỉ là tham khảo; UI dùng text, shape, component/Auto Layout; avatar/nền/minh họa là ảnh riêng. Tên/lớp/điểm/URL minh họa không quyết định dữ liệu, host hoặc API thật.

## 2. Định hướng

- Sáng, nhiều màu nhưng thống nhất; khung nội dung lớn, rõ, có khoảng thở, dễ nhìn với học sinh từ lớp 1. Ưu tiên đọc/hiểu trước trang trí.
- Nền kem bao quanh khung trắng, chữ nâu đậm, viền nhẹ; màu nhấn theo chức năng. Không tạo bảng màu riêng mỗi trang hoặc đặt quá nhiều màu bão hòa cạnh nhau.
- Một hành động chính mỗi vùng. Nhãn ngắn, cụ thể: Vào học, Chơi, Bắt đầu, Tiếp tục, Gửi bài, Quay lại, Làm lại. Kiểm tra tự lưu, không thêm Nộp bài.
- Phân cấp bằng cỡ/độ đậm/khoảng cách; trạng thái có chữ hoặc icon, không chỉ màu. Không cắt dấu hoặc thu nhỏ chữ để nhét khung.
- Áp dụng qua token/component chung theo phạm vi được giao; cập nhật tài liệu không cho phép tự đổi hàng loạt màn.

## 3. Màu sắc

### Bảng màu F và ánh xạ W

Các màu đã được tạo trong collection **Zunimo · Giao diện**, alias sang **Zunimo · Primitives**, chưa đọc lại sau thay đổi bên ngoài. ID màu `VariableID:3:25` đến `VariableID:3:37` theo thứ tự bảng.

| Vai trò     | Biến F             | Mã màu F  | Token W / tình trạng                               |
| ----------- | ------------------ | --------- | -------------------------------------------------- |
| Nền trang   | `color/surface`    | `#FFFAF2` | `--tipy-surface`, khớp                             |
| Nền khung   | `color/white`      | `#FFFFFF` | `--tipy-surface-raised`, `--tipy-on-action`, đã có |
| Chữ chính   | `color/ink`        | `#402B20` | `--tipy-text`, khớp                                |
| Chữ phụ     | `color/muted`      | `#655548` | `--tipy-text-muted`, `--tipy-disabled-text`, đã có |
| Viền        | `color/border`     | `#D8CBBD` | `--tipy-border`, khớp                              |
| Cam chính   | `color/orange`     | `#C84C00` | `--tipy-learn`, khớp                               |
| Cam nhạt    | `color/orangeSoft` | `#FFF0DF` | `--tipy-learn-soft`, khớp                          |
| Xanh ngọc   | `color/teal`       | `#007F6A` | `--tipy-play`, khớp                                |
| Xanh nhạt   | `color/tealSoft`   | `#E4F4EF` | `--tipy-play-soft`, khớp                           |
| Lỗi/xóa     | `color/danger`     | `#B42318` | `--tipy-danger`, khớp                              |
| Nền lỗi/xóa | `color/dangerSoft` | `#FFF0ED` | `--tipy-danger-soft`, khớp                         |
| Disabled    | `color/disabled`   | `#E8E0D5` | `--tipy-disabled`, khớp                            |
| Sao/bục     | `color/gold`       | `#FFD767` | `--tipy-gold`, đã đồng bộ                          |

### Phân vai và kết hợp

- **F:** khung trắng; Primary cam/chữ trắng, Play xanh/chữ trắng; Secondary trắng/chữ tối/viền cam; chọn dùng xanh nhạt; nguy hiểm dùng đỏ nhạt/viền đỏ. Disabled nền disabled/chữ phụ, không làm mờ cả cụm bằng opacity.
- **F:** thân bục vàng, số sao xanh; tên/thứ hạng có chữ/số. Thông báo chưa đọc xanh nhạt, đã đọc trắng.
- **K:** Lớp học có thể dùng xanh nhạt để nhóm trạng thái/chọn; Tin nhắn dùng cam nhạt và cam cho Gửi bài; Kiểm tra dùng xanh cho Bắt đầu/Tiếp tục; Thông báo dùng nền sáng/icon loại sự kiện; Sao dùng vàng. Đây là phân vai kế thừa từ bảng màu, không xác nhận mỗi tab F đã có palette riêng.
- Mỗi vùng có một màu nhấn chính cùng màu trạng thái cần thiết. Đỏ chỉ lỗi/xóa/loại nguy hiểm, không trang trí tab Kiểm tra hoặc nút Trừ sao thông thường. Trên vàng dùng chữ tối, không chữ trắng.
- **W/K:** giữ tương phản chữ thường tối thiểu 4,5:1 và focus rõ. Không tăng sáng bằng filter làm mất tương phản. Kiểm tra từng cặp màu/icon thật, không tự coi mockup đã đạt.

### Màu W chưa xác minh trong F

Focus `#2448A6`; gradient cam cuối/đế `#BC4100/#8C3100`; gradient xanh cuối/đế `#00735F/#005344`; disabled-base `#C9BDAE` là giá trị W. Giữ tương thích tới khi đồng bộ primitive, không buộc thêm gradient/đế nổi vào mọi mẫu F.

## 4. Chữ và biểu tượng

### Font — giữ nguyên website

**W, bắt buộc giữ:** `--tipy-font-family: 'TIPY Nunito', 'Segoe UI', Arial, sans-serif`. Font local khai báo trong `src/styles/tipy-font.css`, weight 400–900, đủ Latin/Latin mở rộng/Vietnamese và giấy phép OFL cạnh font. F dùng Nunito; không đổi tên CSS, tải font khác hoặc thay font toàn website.

| Cấp                   | Giá trị F đã ghi nhận                                                           | Phạm vi / giới hạn                                      |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Tiêu đề trang/khu vực | Desktop 28–32 px, ExtraBold/Black (800/900); tiêu đề tổng quan mobile 26 px/800 | Không lấy chữ bìa thư viện làm h1 toàn site             |
| Tiêu đề panel/dialog  | 22–28 px/800                                                                    | Mobile chi tiết còn thiếu: K đề xuất 22–24 px           |
| Tên ngắn / tên đầy đủ | 18 px/700; thông tin học sinh 20–22 px/700–800                                  | Tên đầy đủ được xuống dòng, không rút ngắn để định danh |
| Nội dung đọc          | 18–20 px/400; nhãn nhấn 18 px/700                                               | Ngắn, đủ lớn cho trẻ                                    |
| Nhãn/thông tin phụ    | 16 px/400 hoặc 700; lỗi/chú thích 14 px/400                                     | 14 px không làm nội dung hướng dẫn chính                |
| Nút/tab               | Nút thư viện 18 px/800, nút thẻ giáo viên 16 px/800; tab 18 px/700              | Không lấy cỡ quản trị làm CTA học sinh                  |
| Kết quả desktop       | Điểm 56 px/900, trạng thái 48 px/900, nhiều phần 36 px/900                      | Đã dựng, chưa xem từng ảnh; mobile chưa đủ F            |
| Đề gõ desktop         | 52 px/800                                                                       | Không áp cứng vào câu dài/điện thoại                    |

**Giãn dòng:** chưa có số line-height/letter-spacing F được đọc/đo riêng. Kế thừa **W**: nội dung 1,6 (một số đoạn 1,65), tiêu đề 1,35, nút 1,4, letter-spacing tiêu đề 0. Đây là fallback, không gắn nhãn “đo từ Figma”. Kiểm tra chiều cao khung sau khi đối chiếu mới.

**Tiếng Việt:** giữ Unicode/dấu, xuống dòng theo từ; chỉ break từ/URL dài để chống tràn. Không ép tên bài/tên người một dòng hoặc cố định chiều cao làm cắt dấu. Giữ ngắt dòng do người soạn nhập, không viết hoa đoạn dài hoặc sửa dữ liệu người dùng để đổi thương hiệu.

**Icon:** SVG Lucide có sẵn, không emoji thay thao tác. F đã nhập SVG stroke 2, icon thường 24 px/trong nút khoảng 20. W TipyButton đã đồng bộ icon 20 px/stroke 2; Từ vựng giữ icon 30 px/stroke 2,4 theo yêu cầu riêng. Icon trang trí `aria-hidden`; icon-only như X cần tên truy cập.

## 5. Khung, khoảng cách và responsive

### Số liệu F đã ghi nhận

| Mẫu                    | Giá trị F                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| Desktop                | 1440 × 900, padding ngoài 32, gap chính 24; rộng hữu dụng 1376 px |
| Mobile tổng quan       | 390 × 844, padding ngoài 16, gap 12; rộng hữu dụng 358 px         |
| Panel                  | Nền trắng, padding 24, radius 24, viền border 1 px                |
| Panel tổng quan mobile | Padding 12 ở thành viên/bục, radius 24                            |
| Spacing                | 4, 8, 12, 16, 24, 32 px, khớp token W space 1–6                   |
| Radius                 | Panel/nút 24, ô nhập/bộ chọn 14, phím 8, thanh cuộn 4 px          |
| Màn chi tiết desktop   | Thanh trái 184, gap tới nội dung 24 px                            |
| Tổng quan desktop      | Bảng phải 420 px, thành viên lấy phần còn lại                     |

Chưa có số bóng F được đọc/đo riêng. **W/K:** panel hiện `0 6px 20px #402B200A`; nút đế 6, nhấn lún 4/đế còn 2 px, transition 120 ms. Giữ tương thích chờ đối chiếu, không gắn nhãn F hoặc thêm bóng nặng cho mọi khung.

### Bố cục

- F là frame tham chiếu, không phải kích thước viewport cố định trong CSS. Dùng Auto Layout/flex/grid và token; khung co ngang có `min-width: 0`, co dọc có `min-height: 0`.
- Desktop: Trở về trái, chọn lớp phải; thành viên trái, Top 3 phải; Thông báo/Kiểm tra/Tin nhắn dưới Top 3. Danh sách cuộn trong panel.
- Mobile tổng quan đã xem: thành viên trên, Top 3 dưới, ba nút dễ tìm ở dưới. Bảng cuộn riêng, không kéo toàn trang dài để tìm điều hướng.
- Desktop chi tiết: thanh chọn phần bên trái, nội dung lớn bên phải, giữ Trở về/chọn lớp. **K:** mobile dùng thanh chọn ngang và một vùng nội dung cuộn, chưa phải mobile chi tiết đã nghiệm thu F.
- Không áp trần 940 px của form xem trước cũ cho toàn khu lớp. Form/preview riêng có thể giữ giới hạn W khi chưa có mẫu tương ứng, phải ghi đúng phạm vi.
- Header tài khoản/avatar/sao website ở nhóm cố định bên phải, không phụ thuộc Lớp học. Riêng `/classroom` và PlaySurface ẩn header/nav website, chuông/nhân vật nổi theo cơ chế có sẵn, không chừa khoảng trống bù.

### Tablet, điện thoại, bàn phím hệ thống — W/K

F chưa có tablet/mobile chi tiết hoàn chỉnh. Kế thừa mốc UI chung W 1000/680 px; khu lớp cần đọc breakpoint trong `classroom-hub.css` trước khi đổi. Không gọi breakpoint là số đo từ hai frame F.

- Tablet chuyển cột khi không đủ nội dung, không scale desktop thành chữ nhỏ.
- Lớp/lượt chơi theo `visualViewport`, `100dvh`, safe area và chiều cao thực khi xoay hoặc mở bàn phím. Khóa cuộn trang khi immersive; danh sách/panel dài cuộn nội bộ, không tràn ngang toàn trang.
- Giữ đề/ô nhập/điều khiển cần thiết thấy được. Nội dung dài theo từng câu/bước hoặc cuộn trong đề. Thu gọn khoảng cách/minh họa/phần phụ trước chữ.
- Giữ hàng số/QWERTY dưới đề. Không ép mọi phím thành 48 px làm tràn viewport; phím mobile chưa có số F xác nhận. Giữ responsive đang hoạt động và thử vùng bấm trên thiết bị thật trước khi đổi.
- Menu/dialog trong viewport, nội dung dài cuộn riêng; X và xác nhận luôn truy cập được, hàng cuối không bị ancestor overflow cắt.

## 6. Component và trạng thái

Kích thước F là của **main component** hoặc frame đã dựng, không phải width cứng mọi instance. Dùng FILL/HUG theo khung, giữ tỷ lệ ảnh. Hành vi bàn phím/focus/lỗi dưới đây là **W/K**, trừ khi ghi F cụ thể.

| Mẫu                | Cấu trúc, số liệu và màu F                                                                                                                                              | Code cần tái sử dụng                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Nút                | Main 176 × 56, padding ngang 16, gap 8, radius 24; Tone Primary/Secondary/Play/Danger, State Default/Pressed/Disabled/Loading; chữ 18/800, icon 20, đổi được label/icon | `src/components/TipyButton.jsx`, `src/styles/tipy-button.css`                                                                |
| Tab                | 168 × 56, padding ngang 16, gap 8, radius 14; Default/Selected/Disabled, chọn dùng tealSoft và chữ/viền teal                                                            | `src/features/classroom/ClassroomPage.jsx`, kiểu chung `tipy-ui.css`; không tự tách lớp trừu tượng nếu chưa cần              |
| Chọn lớp           | Main 260 × 56, instance mobile tổng quan rộng 180; radius 14, Closed/Open, chữ 20, chevron xoay                                                                         | `src/components/ActionMenu.jsx`, `src/styles/action-menu.css`                                                                |
| Thẻ thành viên     | Main 116 × 136, Default/Selected, kem/xanh nhạt, radius 24, tên ngắn 18/700; instance co theo lưới                                                                      | `ClassroomPage.jsx`, `src/features/classroom/Avatar.jsx`, `classroom-hub.css`                                                |
| Avatar             | Main 80 × 80, radius 24, FIT/contain; hồ sơ 80, dialog 56, bục desktop 64/mobile tổng quan 48                                                                           | `Avatar.jsx`, `src/characters/catalog.js`, không emoji                                                                       |
| Bục Top 3          | Rank 3/1/2 rộng 112/cao 252, thân 52/104/78; tên 18/sao 16 xanh; thứ tự 3–1–2, gold. Mobile tổng quan rộng 100, thân 36/64/50                                           | `ClassroomPage.jsx`, `classroom-hub.css`; không nhét cả bảng game cũ vào bục                                                 |
| Thông tin học sinh | Rộng 460, padding/gap 24/16, radius 24, cam nhạt; avatar, tên đầy đủ, username, tổng sao, Cộng/Trừ/Loại                                                                 | Menu trong `ClassroomPage.jsx`, `src/features/admin/StudentActionDialog.jsx`                                                 |
| Hộp sao/loại       | Rộng 480, padding 24/gap 16, trắng/radius 24; Gift/Deduct/DeductError/Remove/RemoveReady; X 48, danh tính, số dư, form, xác nhận                                        | `StudentActionDialog.jsx`, `src/components/Modal.jsx`, xác nhận loại trong `ClassroomPage.jsx`                               |
| Ô nhập/form        | Main rộng 320 theo parent, nhãn 16, box cao 52, radius 14, padding ngang 16; Empty/Filled/Error/Disabled; lỗi 14 đỏ dưới trường                                         | `src/components/ValidatedForm.jsx`, form đang có; textarea không ép vào box một dòng                                         |
| Thẻ kiểm tra       | Rộng 480, padding/gap 16/12, trắng/radius 24, tên 22/800; Role Teacher/Student × Draft/Upcoming/Open/Closed/Hidden/InProgress                                           | `src/features/assessments/AssessmentsPage.jsx`, `AdminAssessments.jsx`, `AssessmentSummary.jsx`, `ResultViews.jsx`           |
| Bài đăng/preview   | Main rộng 800, padding 24/gap 16, radius 24; người gửi, tiêu đề 28/nội dung 20, ảnh riêng, link, tài liệu                                                               | `src/features/classroom/ClassMessages.jsx`, `PostComposer.jsx`, `Attachment.jsx`                                             |
| Thông báo          | Main rộng 560, padding/gap 16, radius 24; Unread xanh nhạt/Read trắng, icon loại, tiêu đề 18/mô tả 16                                                                   | `ClassNotifications.jsx`, `src/features/notifications/StudentNotifications.jsx`, `useNotifications.js`                       |
| Trống              | Rộng 400, padding dọc 32/ngang 24, gap 16; icon, tiêu đề 22/giải thích 18                                                                                               | Trạng thái hiện có từng feature; `src/components/Loading.jsx` chỉ dùng khi đang tải                                          |
| Thanh cuộn         | Main rãnh rộng 8/radius 4/nền disabled; thumb cam rộng 8/cao mẫu 76; chiều dài theo panel                                                                               | `.hub-scroll` trong `classroom-hub.css`; W rãnh CSS 14/viền thumb 3 px giúp dễ kéo, không máy móc thu vùng tương tác xuống 8 |
| Phím bàn phím      | Main 48 × 44/radius 8/chữ 18; Default/Pressed/Hint/Disabled; Hint xanh nhạt/viền xanh, Pressed xanh/chữ trắng; instance gameplay desktop 64 × 52                        | `src/components/Keyboard.jsx`, `src/styles/play-surface.css`; không áp cỡ main cho mobile chưa dựng                          |
| Kết quả            | Frame desktop 1440 × 900, nền cảnh, ảnh sao 250 × 250 FIT, điểm → trạng thái → Quay lại trái/Làm lại phải; điểm nhiều phần riêng                                        | `src/components/CompletionScreen.jsx`, `play-surface.css`; mobile chi tiết chưa đủ F                                         |

### 6.1. Tương tác chung

- Nút thật giữ `type`, callback và disabled; loading chặn gửi trùng, `aria-busy`, nhãn xử lý rõ. Disabled không gọi hành động. CTA học sinh có icon + chữ; X có tên truy cập “Đóng…”.
- **W/K:** điều khiển ngoài QWERTY tối thiểu 48 × 48; CTA chung cao 56/chữ 18. Admin giữ bản gọn 48/chữ 16 với radius 24; Từ vựng giữ 64/chữ 22 theo yêu cầu riêng. Thanh công cụ lượt chơi và màn thấp có thể dùng bản gọn 48 để luôn thấy nội dung.
- Focus-visible W: outline nút 3 px màu focus, offset 4 px, không cắt outline. Tab/Enter/Space như native; ActionMenu thêm mũi tên/Home/End, Esc/bấm ngoài, trả focus về nút mở; `aria-selected`/`aria-expanded` đúng trạng thái.
- Modal qua `Modal.jsx`/Radix: giữ focus, khóa cuộn nền, X/Esc theo cơ chế hiện có. Ghi thao tác nguy hiểm phải khóa gửi lại/đóng theo luồng có sẵn; không bỏ cảnh báo mất bản soạn để khớp ảnh tĩnh.
- Form có label, lỗi cạnh trường, `aria-invalid`/`aria-errormessage`, focus lỗi đầu. Nhập sai không gọi API; lỗi mạng giữ bản soạn, chỉ reset sau backend xác nhận. Menu/dialog/scroll dùng được bằng chuột, cảm ứng và bàn phím.
- Tải, trống, lỗi và thành công là trạng thái khác nhau. Trống dùng câu ngắn, lỗi có Thử lại; không báo trống/Đã lưu để che lỗi. Phản hồi nhấn nhẹ, không animation lặp, tôn trọng `prefers-reduced-motion`.

### 6.2. Hành vi từng khu vực

**Lớp học:** bộ chọn chỉ có lớp được phép, danh sách dài cuộn riêng; đổi lớp giữ tab phù hợp/bỏ phản hồi cũ. Tên dưới avatar là từ cuối sau chuẩn hóa khoảng trắng, giữ dấu; tên đầy đủ/username ở nhãn truy cập và hộp thông tin, không dùng tên ngắn làm khóa. Ảnh/nền/viền/bóng cùng khung vuông, ảnh contain, không kéo méo/cắt hình. Top 3 có nhãn Sao trong lớp tuần này/khoảng ngày; ít hơn ba người chỉ hiện dữ liệu thật, phân biệt lớp trống/chưa có thành tích/lỗi. Chỉ người có quyền mở menu học sinh.

**Sao và loại:** số nguyên dương, trừ không quá số dư ở client/backend, hiện số còn lại trước xác nhận, đúng tên/avatar/tổng sao/ghi chú. Loại ghi rõ lớp/học sinh và yêu cầu đúng `accept` hai phía; chỉ xóa membership của lớp đó. Tặng ở quản lý: một lớp hợp lệ chọn sẵn, nhiều lớp cho chọn, không lớp ghi Chưa gắn lớp. Không suy quà cũ từ lớp hiện tại. Mỗi ghi hợp lệ một request và mã yêu cầu ổn định khi thử lại.

**Tin nhắn/gửi bài:** học sinh vào sau xem bài cũ của lớp, bị loại thì mất quyền đọc mới và file. Form giáo viên gồm Tiêu đề/Nội dung/Link/Ảnh hoặc tài liệu cùng preview, tối đa 3 file/5 MB mỗi file. Chọn/hủy/thay/xóa/chọn lại file/quay lại cửa sổ giữ nội dung, không upload/lưu bài. Chỉ upload lúc Đăng bài; lỗi giữ form, thu hồi URL preview đúng lúc, xử lý file mồ côi theo cơ chế hiện có. Chọn bài kiểm tra đã soạn để giao các lớp được phép dùng API hiện có.

**Kiểm tra:** giáo viên có Tạo bài, nháp/chưa đến giờ/đang mở/đã kết thúc/đã ẩn, Ẩn/Hiện/Xóa và kết quả theo quyền. Học sinh Bắt đầu/Tiếp tục, backend xác minh quyền/lịch/lượt rồi mở fullscreen trực tiếp. Từ thông báo có thể xem thông tin theo lịch, đọc thông tin không tự tạo lượt. Bài ẩn không tạo lượt mới, giữ luật lượt đang làm; xóa có xác nhận vĩnh viễn. Không đưa nút quản trị vào tài khoản học sinh.

**Thông báo:** cùng nguồn cho panel/chuông/lời nhắc, chỉ tự mở ở trang chủ. Trong lượt chơi không che đề; chờ xem sau. Đóng đánh dấu theo lô, mở/đóng lịch sử đã tải dùng cache; trống ghi “Em chưa có thông báo mới.” Chuông W tròn 56 px dưới trái, tránh nhân vật/gameplay. Sự kiện gồm kiểm tra, quà sao và bài đăng luồng lớp; reset/trừ/xóa sao không tạo thông báo. Tên theo giáo viên thực hiện, Admin hiện Thầy Hùng, không đổi định danh xác thực.

**Luyện gõ/kiểm tra:** dùng `PlaySurface`, `TypingGame`, `LessonPlayer`/adapter. Fullscreen API gọi trực tiếp từ thao tác bắt đầu; từ chối/không hỗ trợ vẫn phủ trình duyệt. Esc thoát native giữ lượt. Header gọn Quay lại/Tạm dừng và tên/thời gian/tiến độ, bàn phím dưới đề. Phím nhấn khác phím gợi ý; touch chỉ nhận một lần, phản hồi cục bộ. Giữ textarea thật/IME/composition/Unicode; resize/xoay/pause không remount engine hoặc tính thêm lượt. Rời lượt đang làm dùng xác nhận hiện có.

**Kết quả:** chính thức sau backend xác nhận; sao → điểm → Hoàn thành tốt/Chưa hoàn thành → Quay lại trái/Làm lại phải, chưa đạt có động viên. Chỉ Làm lại khi còn lịch/lượt; nhiều phần chờ đủ phần và giữ thang điểm riêng, không cộng sai đơn vị. Luyện tập giữ Luyện lại/Bài tiếp theo tiến trình. Sao minh họa không cấp thưởng; hiệu ứng/âm thanh một lần cho kết quả mới đạt, tôn trọng cài đặt/giảm chuyển động.

## 7. Nghiệp vụ và an toàn giữ nguyên

Các ràng buộc **W** không được thay bằng dữ liệu mẫu F. Chi tiết theo `ARCHITECTURE.md`, `BACKEND.md`, SQL liên quan.

- Vai trò từ backend: Admin quản trị tài khoản/lớp/game/reset và tạo/phân công giáo viên. Giáo viên chỉ lớp được giao, quản lý bài của mình, xem kết quả đúng phạm vi, cộng/trừ sao và loại thành viên theo quyền hiện có. Chưa phân công hiện “Bạn chưa được phân công lớp.” Không thêm điểm tặng hoặc nâng role để dùng UI. API/RPC/RLS/Storage kiểm tra cả đọc/ghi/file; cache/URL không chứng minh quyền.
- **Sao của bạn:** ledger SUM(amount − reset_amount), gồm sao bài học/quà/thưởng tuần và tác động trừ/reset, không cộng điểm game. Bài học chỉ phần tăng thêm/tối đa 3 sao; bằng/thấp hơn không cộng. Phân biệt best_stars với sao đã thưởng, không cấp bù dữ liệu cũ từ best. Khách không nhận sao tài khoản, chưa có store/tiền khác; nguồn/biên nhận/transaction chống lặp và đồng thời.
- **Sao trong lớp tuần này:** chỉ quà có class_id đúng lớp, thứ Hai 00:00 đến trước thứ Hai kế tiếp theo `Asia/Ho_Chi_Minh`; trừ cùng lớp/tuần giảm tới 0, reset không làm sao cũ trở lại. Không dùng tổng tài khoản/sao bài học/thưởng game/quà cũ thiếu nguồn lớp. Hòa sao dùng tên rồi user_id ổn định. Backend tổng hợp/lấy Top 3, giữ lịch sử, không ghi đè số dư mỗi tuần; timer một lần ở ranh giới tuần theo giờ server, cache lớp/tuần.
- **Chữ rơi · Khó** là bảng điểm chơi riêng, không trong bục sao. hard-v1 giữ A–Z, fall 3/minFall 1, spawn 0,95/minSpawn 0,65, max 10; +10/chữ, 3 mạng, sai lần 6 kết thúc, mỗi 500 điểm tăng tốc. Chỉ game_over hợp lệ/điểm >0/membership liên tục từ bắt đầu tới ghi/chốt đủ điều kiện; rời/vào lại là kỳ mới. Luyện tự do giữ cấu hình. Cron thưởng backend 00:05 giờ Việt Nam xử lý tuần bỏ lỡ, không phụ thuộc mở trang/tái dựng best/latest.
- **Reset sao** về số dư 0, giữ tiến độ/kết quả/mức tốt nhất/mức đã thưởng: 3 sao không nhận lại, 2→3 chỉ cộng 1; quà mới bình thường. **Làm lại từ đầu** quản trị là thao tác khác theo game: xóa dữ liệu tiến độ/kết quả/sao bài học/lượt liên quan theo backend, giữ tài khoản/nhân vật/lớp/game khác/thời gian tích lũy/quà/thưởng đã chốt. Chỉ Admin, xác nhận `accept` và biên nhận; không thử dữ liệu thật.
- Kiểm tra là snapshot bất biến sau gửi, nguồn lớp rõ/thành viên hiện tại kể cả vào sau, không suy từ tên. Mỗi thao tác kiểm tra quyền/lịch/lượt/giờ server. Adapter không gọi endpoint luyện tập/cộng sao/bảng tuần. Backend chọn tốt nhất từng phần trong lượt nộp hợp lệ, bằng điểm giữ lượt đạt trước; điểm/thời lượng/ngày nộp cùng lượt, giữ lịch sử/tổng lượt, tổng hợp trước phân trang. Khác thang không cộng chung.
- Không Nộp bài thủ công: đạt/vượt mục tiêu Chữ rơi hoặc điều kiện kết thúc, hoàn tất nội dung gõ thì tự chuyển phần/chốt cuối. Nháp cục bộ theo tài khoản/bài/lượt chỉ khôi phục sau backend kiểm tra. Một finalizer khóa nhập/đồng hồ, giữ requestId khi lỗi. Bài thường không ghi giữa lượt; bài có deadline bằng chứng thay đổi tối đa một lô/30 giây. Quá hạn chỉ tính bằng chứng server nhận trước hạn; chưa xác nhận hiện Đang lưu kết quả…/Chưa lưu được, thử lại.
- Backend phân trang quản trị học sinh/kết quả/giáo viên 7 hàng; tổng quan lớp 24 thành viên/trang; lịch sử thông báo 20 mục. Không đổi theo số ô F. Chọn cả trang chỉ tác động trang hiện tại; đổi lọc/trang bỏ chọn theo luồng có sẵn. Backend lọc/tìm/sắp xếp/tổng hợp, không N+1.
- Menu học sinh một Tùy chọn đúng quyền. Xóa tài khoản khác Loại khỏi lớp: giữ nhập đúng username/kiểm chứng xóa. Lớp lưu trữ mới Xóa vĩnh viễn; xác nhận tên lớp, giữ trạng thái Storage chưa dọn và Dọn tệp còn lại sau reload. Không tự xóa tài khoản/lớp/bài thật để thử.
- Cache đúng tài khoản/lớp/tab/trang, chia sẻ request/bỏ phản hồi cũ, admin tối đa 30 giây theo luồng hiện có. Tab/ảnh lazy, không polling liên tục/check quyền lặp/tải lịch sử từng hàng. Đổi tài khoản xóa cache riêng; dọn listener/timer/Realtime khi đổi phạm vi/rời trang. Tệp private qua endpoint cùng origin kiểm tra từng lần tải, không dùng link Storage đã ký để bỏ qua quyền.

### Khu chưa có đủ F — kế thừa W

- Bản đồ Bé chinh phục bàn phím giữ tỷ lệ đảo 1672/941 và tọa độ phần trăm `adventure.js`, 5 vùng → bài → lượt chơi. Giữ lesson ID/điều kiện mở/Cùng học/Đua xe một mình/tiến bộ/5 bài gần đây. Bản đồ cuộn ngang riêng min-width 960 khi cần, không tràn trang. Không thêm lại kho báu/store/sticker sưu tập/panel gợi ý đã bỏ. Không áp luật sai/mất mạng Chữ rơi sang bài học gõ chữ.
- Giữ `LessonPlayfield` cho world 1–5; tài nguyên `src/assets/alphabet`/`letter-stickers.js` gồm A–Z, Ă/Â/Ê/Ô/Ơ/Ư, ảnh thiếu dùng chữ đủ dấu, không tự ghép dấu hoặc sửa nhập liệu. Từ vựng world 0/9 chủ đề giữ nhánh hiện có. Bộ nền/guide theo `adventure.js`, contain/lossless, chỉ mount/tải phần cần.
- Nhân vật theo `src/characters/catalog.js`, PNG thật/Avatar chung, khác guide bài; dùng ảnh đã lưu, không bản chọn thử. Nổi mặc định desktop/mobile 96/72 px, clamp 60–160%, vị trí chuẩn hóa 0–1 theo viewport; chỉ nút nhân vật nhận pointer. Kéo/ẩn/kích thước lưu cục bộ theo tài khoản, không ghi mỗi chuyển động/thêm API; Lưu thành công mới chốt, hủy khôi phục, ẩn không đổi avatar.
- Bong bóng giữ câu `companion-speech.js`, 2,5 giây, không queue/lặp; gõ cách tối thiểu 9 giây, sự kiện quan trọng ưu tiên. Chữ W 18 đậm/nền kem/viền xanh, không chặn pointer/dưới modal; thiếu chỗ/đang chơi thì ẩn theo cơ chế có sẵn. Thông báo nói một lần theo tài khoản + notification_id tại server, hai tab/reload không phát lại; giữ cài đặt ẩn/âm thanh, không tự thêm giọng đọc.
- Chọn nhân vật dùng radio/Đang chọn/ảnh contain-lazy, Lưu ở footer không cuộn, X/Esc bỏ bản chưa lưu; header/X/footer luôn truy cập được, một vùng nội dung cuộn, đệm cuối/safe area. Âm thanh/tài khoản giữ cuộn/khóa nền. Cài kích thước ở phải danh sách desktop/dưới danh sách mobile. Lịch sử chơi chỉ quản trị, không thêm tab Tài khoản/Nhân vật.
- Điều hướng lớp chỉ theo quyền backend; giáo viên vẫn có Lớp của tôi khi chưa phân công. Người chưa có lớp có thể Luyện bàn phím; học sinh nhận kiểm tra riêng vẫn xem theo quyền. Nhóm tài khoản luôn bên phải dù mục khác ẩn/hiện.

## 8. Ánh xạ code và tiến độ đồng bộ

| Nguồn dùng chung                                                   | Trách nhiệm                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/styles/tipy-tokens.css`                                       | Màu/font/spacing/radius/shadow toàn site                                              |
| `src/styles/tipy-font.css`                                         | Font hiện tại, không đổi trong đợt chuẩn hóa này                                      |
| `src/styles/tipy-button.css`, `src/styles/tipy-ui.css`             | Primitive nút/kiểu dùng chung, đổi tại nguồn khi triển khai                           |
| `src/features/classroom/classroom-hub.css`                         | Hình học lớp/scroll/responsive theo feature, không nhân bản palette                   |
| `src/styles/play-surface.css`                                      | Hình học vùng chơi/kết quả theo viewport; không đặt rule gameplay rộng trong UI chung |
| `src/components/PlaySurface.jsx`, `src/hooks/useDialogViewport.js` | Fullscreen/visual viewport, giữ engine và nội dung khi resize                         |
| `src/features/classroom/hub-cache.js`, `src/game/backend.js`       | Cache/request/phiên; không sửa để bù layout sai                                       |

### Đã áp dụng vào code ngày 20/11/2026 và phần còn thiếu

1. **Đã khớp:** 12 màu nền/chữ/viền/cam/xanh/lỗi/disabled, spacing 4–32, radius panel 24/input 14; font hiện tại cùng họ Nunito. Không đổi font hoặc tạo palette mới.
2. **Vàng:** thêm `--tipy-gold: #FFD767`, dùng cho bục; số sao xanh ngọc. Bảng màu không thay đổi dữ liệu sao.
3. **Nút:** CTA chung đã 56/chữ 18/icon 20/radius 24, stroke 2; phụ chữ tối/viền theo vai trò. Admin giữ 48/chữ 16/radius 24. Giữ type/disabled/loading/callback và chiều sâu W. Từ vựng có scope riêng giữ kích thước/kiểu cũ.
4. **Lớp:** desktop padding 32/gap 24/sidebar 184/cột phải tối đa 420; avatar thành viên 80/radius 24. Mobile padding 16, ba cột thành viên, bục và điều hướng phía dưới; màn ngang thấp giữ bố cục gọn riêng. Khung bấm và ảnh luôn cùng kích thước. Bục giữ thứ tự 3–1–2, thân 52/104/78 desktop và 36/64/50 mobile.
5. **Chữ:** W nội dung 19, h1 clamp 28–36/h2 28 và leading chung; F phân cấp theo mục 4. Giữ font, chỉ tách token ngữ nghĩa cho cỡ/weight/leading thật sự cần khi triển khai; chưa có leading F xác nhận.
6. **Game/kết quả:** đã dựng desktop nhưng chưa audit từng màn, mobile mới tổng quan. Không dùng mã bản dựng dự kiến chưa ghi vào F làm số đo mobile. Đọc lại từng engine/pause/saving/error/result và thử IME/keyboard thật trước khi đổi hình học/cỡ sao/chữ/nút. Không phục hồi quy tắc 48 px/cuộn ngang cho mọi lượt chơi.
7. **Khoảng trống:** bóng, focus, leading, tablet, mobile chi tiết và prototype chưa đủ số đo F. Giữ fallback W ghi ở đây; ảnh Pressed/Loading không chứng minh tương tác chạy thật.

Chủ dự án đã cho phép áp dụng code và triển khai trong yêu cầu ngày 20/11/2026. Thay đổi giao diện không cần migration, không sửa API/phân quyền/engine. Chưa có Code Connect đã xác minh để tự áp mapping F → code. Tái sử dụng component hiện có, không tạo bản sao chỉ vì tên layer khác. Trạng thái deployment và kiểm tra thực tế nằm trong báo cáo bàn giao, không suy từ tài liệu này.

## 9. Kiểm tra và cập nhật chuẩn

- Trước khi sửa UI, xác nhận node/trạng thái đúng phần, ghi nguồn F/W/K, kiểm tra token/nơi dùng. Bị chặn thì nêu phần thiếu, không tuyên bố đối chiếu mới nhất. Cập nhật chuẩn và primitive/token cùng thay đổi triển khai, kiểm tra nơi bị ảnh hưởng.
- Kiểm tra desktop/tablet/mobile, ít nhất cỡ tham chiếu 1440 × 900 và 390 × 844; thêm nhỏ/ngang theo phạm vi. Thử chữ dài/dấu Việt/tên ngắn trùng/danh sách đông/trống/hàng cuối/safe area/bàn phím hệ thống, tương phản, focus, reduced motion.
- Thử Default/Pressed/Selected/Open/Closed/Loading/Disabled/Error/Empty/Success theo component; X/Esc/ngoài menu, Tab/Enter/Space/mũi tên và trả focus. Đổi bố cục không gọi API hoặc bắt đầu lại lượt.
- Khi code đổi chạy `npm run build`, `npm test` và kiểm tra luồng liên quan: `scripts/check-classroom-hub.mjs`, `scripts/check-play-surface.mjs`, `scripts/check-assessment-autosave.mjs`. Script bố cục trước hub/auto-finish không thay nghiệm thu hiện tại. Dùng database/tài khoản thử, không gửi đề/tặng/reset/xóa dữ liệu thật.
- Tài liệu thuần túy: Prettier hai file, `git diff --check`, kiểm tra đường dẫn/node ID/hex/số liệu/mâu thuẫn. Không bắt buộc build/test gameplay khi runtime không đổi; báo rõ không có kiểm thử giao diện mới.
