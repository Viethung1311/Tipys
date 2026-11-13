# Zunimo — chuẩn giao diện dùng chung

### Biểu mẫu và dữ liệu

- Dùng `ValidatedForm` cho form tài khoản/quản trị: lỗi tiếng Việt ngay dưới trường, focus trường sai đầu tiên, giữ nội dung và mật khẩu nguyên văn. Enter và nút gửi đi chung đường kiểm tra; dữ liệu sai tại máy không gọi API. Lỗi có `aria-invalid`/`aria-errormessage`, nhãn truy cập giữ ổn định.
- Bảng quản trị dùng cache bộ nhớ tối đa 30 giây theo tài khoản/bộ lọc/trang, xóa khi ghi dữ liệu, đổi tài khoản hoặc quay lại tab. Nút làm mới chủ động phải bỏ cache. Không dùng cache kết quả hoàn tất để bỏ qua kiểm tra quyền lớp/bài của học sinh.
- Trang đứng yên không polling danh sách hoặc tổng sao; nạp lại khi quay lại tab và sau thao tác liên quan. Checkpoint lượt đang chơi và cron chốt giờ/thưởng vẫn giữ nguyên vai trò.

### Bài kiểm tra: lịch, lượt và kết quả

- Chi tiết/xem trước dùng panel chung như bài đăng lớp: nền trắng, bo góc/viền/bóng theo token, tối đa 940 px, căn giữa. Chia tên bài, giới thiệu, cách chơi, thời gian, số lượt; mỗi phần chơi là thẻ nhỏ, nút trong footer thẻ. Giữ xuống dòng nội dung; một cột ở máy hẹp. Không tái sử dụng PostComposer như một form giả: dùng lớp panel chung hiện có.
- Trong lúc đọc thẻ, tạm không hiển thị nhân vật/bong bóng nổi để tránh che nội dung, giữ nguyên tùy chọn đã lưu. Học sinh không thấy nơi nhận của người khác.

- Form giáo viên dùng giờ Việt Nam; chọn rõ Theo lịch/Luôn mở và số lần làm thêm sau lượt đầu. Chỉ nháp được sửa; bài đã gửi tạo bản mới để đổi luật/lịch.
- Mục tiêu chỉ thuộc phần Chữ rơi. Kết quả đạt mục tiêu có tiêu đề “Hoàn thành tốt” lớn, đậm, căn giữa; hiệu ứng một lần, tắt khi giảm chuyển động. Âm chúc mừng dùng hệ thống âm thanh chung, không phát lại khi mở lịch sử hoặc reload. Chưa đạt dùng “Cần luyện thêm”, không hiệu ứng thắng.
- Kết quả giáo viên: bảng 7 học sinh/trang, lọc/sắp xếp phía backend; phần chính ghi “Kết quả tốt nhất”, chọn riêng từng phần trong các lượt đã nộp, bằng điểm giữ lượt đạt trước. Điểm, thời lượng, ngày nộp và hoàn thành của mỗi phần thuộc cùng lượt; giữ riêng trạng thái lượt hiện tại và lịch sử trong Chi tiết. Không cộng điểm khác đơn vị. “Kết quả của em” dùng cùng quy tắc. Điện thoại cuộn ngang riêng bảng, không làm tràn trang.
- “Kết quả của em” chỉ tải lượt của tài khoản trong phiên. Modal dùng X/Esc và component chung. Xóa bài dùng nhãn “Xóa vĩnh viễn”, modal ghi rõ mất nội dung/người nhận/lượt làm/kết quả và yêu cầu đúng accept. Tab cũ phải ngừng khi backend báo bài đã được xóa.

Thương hiệu hiển thị duy nhất: **Zunimo**, gồm header, footer, metadata và thông báo mặc định. Giữ định danh kỹ thuật cũ (TipyButton, font `TIPY Nunito`, token, API, cookie, bucket, đường dẫn); không thay chuỗi hàng loạt vào dữ liệu người dùng. Logo là chữ/SVG dựng bằng code, không có bitmap thương hiệu cũ trong bộ ảnh đang sử dụng. Bỏ khối địa chỉ và khoảng trống của nó.

Điều hướng Lớp học chỉ hiện với admin hoặc học sinh có lớp đang hoạt động do backend xác nhận. Người chưa có lớp dùng CTA **Luyện bàn phím** → Gõ chữ; thành viên dùng **Vào học** → các lớp được tham gia. Mỗi lần vào/quay lại lớp hoặc lấy tệp phải kiểm tra lại quyền; không hiển thị cache trước xác minh. Khi tab trở lại/focus hoặc API báo mất quyền, xóa nội dung và nạp lại danh sách lớp. Tệp dùng endpoint cùng origin kiểm tra phiên/quyền mỗi lần tải, không phát link Storage đã ký ra trình duyệt.

Nguồn yêu cầu: Custom instructions của Project “Web game Tipy”, do chủ dự án cung cấp trong chat. Đọc cùng `AGENTS.md` trước mọi thay đổi UI. Giữ nguyên các hướng dẫn kỹ thuật ở `ARCHITECTURE.md` và `BACKEND.md`; đây là chuẩn thiết kế, không thay đổi quyền hoặc dữ liệu.

Thao tác sao: Tùy chọn của học sinh có Tặng sao/Trừ sao, dùng chung hộp thoại với ảnh đại diện thành viên lớp. Chỉ admin theo quyền quản lý hiện có được mở menu ảnh; vùng bấm tối thiểu 64 px, dùng ActionMenu chung (Tab/Enter/Space, Esc, bấm ra ngoài). Hộp thoại ghi rõ học sinh, ảnh nếu có, tổng sao, số sao còn lại và lý do; không dùng màu đỏ cho thao tác trừ sao thông thường. Dữ liệu sai không gửi API. Trừ sao không xóa tiến độ hoặc mức sao đã thưởng từng bài.

## 1. Định hướng

Website học tập cho học sinh từ lớp 1: vui nhộn, thân thiện, gọn gàng và dễ hiểu. Ưu tiên ít chữ, chữ lớn, thao tác rõ và biểu tượng quen thuộc. Mỗi màn hình có một hành động chính nổi bật. Admin dành cho giáo viên có thể nhiều thông tin hơn nhưng vẫn chung nhận diện.

## 2. Nút

- Bo tròn, chiều sâu nhẹ như mẫu “Vào học” và “Chơi”. Dựng bằng HTML/CSS và SVG, không dùng ảnh chụp nút làm UI.
- Nhãn 1–3 từ, động từ cụ thể: “Vào học”, “Chơi”, “Nộp bài”, “Xem bài”, “Làm lại”, “Quay lại”. Không rút ngắn đến mức mất nghĩa; hành động quan trọng cần rõ ràng.
- Nút chính học sinh có cả chữ và icon, không chỉ icon. Cao tối thiểu 56 px, chữ 20–24 px đậm, padding rộng; các vùng bấm khác tối thiểu 48 × 48 px và cách nhau đủ để tránh bấm nhầm.
- Có normal, pressed, focus-visible, loading, disabled. Nhấn lún nhẹ; không có chuyển động lặp hoặc hiệu ứng gây phân tâm.

## 3. Màu và tương phản

- Cam dùng cho thương hiệu/hành động chính “Vào học”; xanh ngọc dành cho chơi.
- Nền trắng hoặc trắng kem, chữ tối dễ đọc. Đỏ dành cho lỗi/xóa, không trang trí nút thông thường. Vai trò màu nhất quán giữa các trang.
- Không chỉ dùng màu để báo trạng thái: thêm nhãn/icon. Nếu trắng trên cam không đủ tương phản, chỉnh nền hoặc dùng chữ tối.
- Nút mẫu dùng trắng trên cam đậm/xanh ngọc để giữ tinh thần ảnh tham khảo và đạt ít nhất 4,5:1. Không tăng độ sáng bằng filter khi hover vì có thể làm giảm tương phản.

## 4. Chữ và icon

- Font chính: **Nunito**, nét tròn và đủ dấu tiếng Việt; bản local được khai báo với tên CSS `TIPY Nunito`. Có Latin, Latin mở rộng và Vietnamese; giấy phép OFL đặt cạnh font. Fallback: Segoe UI, Arial, sans-serif.
- Nội dung học sinh 18–20 px; tiêu đề 28–36 px và co giãn phù hợp trên điện thoại. Chữ theo câu (“Vào học”), không viết hoa đoạn dài. Không dùng font trang trí khó đọc cho nội dung/hướng dẫn.
- SVG Lucide hiện có, cùng nét bo tròn, stroke 2,4 ở nút; icon trang trí `aria-hidden`, nhãn chữ là tên truy cập được.

## 5. Bố cục và nội dung

- Khoảng trắng rộng, thẻ bo tròn, phân cấp rõ. Điện thoại ưu tiên một cột và nút dễ chạm.
- Mỗi thẻ chỉ chứa thông tin cần thiết; chi tiết đưa sang trang riêng.
- Hướng dẫn ngắn, từ quen thuộc, mỗi câu một việc. Phản hồi rõ: đã nộp bài, đang tải, chưa có bài, cần thử lại.
- Không cắt chữ, che dấu tiếng Việt hoặc gây cuộn ngang ngoài ý muốn.

## 6. Token và component

Nguồn token: `src/styles/tipy-tokens.css`. Nguồn nút: `src/components/TipyButton.jsx`, style `src/styles/tipy-button.css`. Không chép màu/chiều sâu nút vào CSS của từng trang. Khi cần kiểu mới, cập nhật chuẩn này và component chung trong cùng thay đổi.

| Vai trò                        | Token / giá trị                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Font                           | `--tipy-font-family`: `TIPY Nunito`, Segoe UI, Arial, sans-serif                           |
| Nền                            | `--tipy-surface`: `#fffaf2`; `--tipy-surface-raised`: `#ffffff`                            |
| Chữ chính                      | `--tipy-text`: `#402b20`                                                                   |
| Cam / cuối gradient / đế       | `--tipy-learn`: `#c84c00`; `--tipy-learn-end`: `#bc4100`; `--tipy-learn-base`: `#8c3100`   |
| Xanh ngọc / cuối gradient / đế | `--tipy-play`: `#007f6a`; `--tipy-play-end`: `#00735f`; `--tipy-play-base`: `#005344`      |
| Chữ nút                        | `--tipy-on-action`: `#ffffff`                                                              |
| Focus                          | `--tipy-focus`: `#2448a6`, outline 3 px, cách 4 px                                         |
| Lỗi/xóa                        | `--tipy-danger`: `#b42318`                                                                 |
| Disabled                       | nền `#e8e0d5`, chữ `#655548`; không dùng opacity làm mờ cả nút                             |
| Khoảng cách                    | token space 1–6: 4, 8, 12, 16, 24, 32 px                                                   |
| Nút mẫu                        | cao 64 px (tối thiểu quy tắc 56), chữ 22 px/800, icon 30 px, gap 12 px, padding 14 × 24 px |
| Bo góc / chiều sâu             | 24 px / đế 6 px; khi nhấn lún 4 px, đế còn 2 px                                            |
| Chuyển trạng thái              | 120 ms; tắt transition khi giảm chuyển động                                                |

### API nút

```jsx
<TipyButton variant="learn" onClick={onClassroom} disabled={!canClassroom}>
  Vào học
</TipyButton>
<TipyButton variant="play" onClick={() => onChoose(screen)} disabled={!screen}>
  Chơi
</TipyButton>
<TipyButton variant="learn" loading loadingLabel="Đang mở…">
  Vào học
</TipyButton>
```

- `learn`: tên lửa Rocket; `play`: tay cầm Gamepad2. Không dùng icon/nhãn từ ảnh bitmap.
- Native `<button type="button">`; có thể truyền `type="submit"`, `onClick`, thuộc tính aria và class bố cục.
- Loading vô hiệu hóa thao tác, có `aria-busy`, chữ đang xử lý và icon đồng hồ cát đứng yên. Disabled không gọi hành động; nguyên nhân được giải thích ở vị trí sử dụng bằng `aria-describedby` khi cần.
- Dùng phím Tab để focus, Enter/Space để kích hoạt; outline không bị cắt. Không dùng animation lặp hoặc tự nhảy khi hover.
- Giai đoạn thử đầu đổi CTA lớp thành “Vào học” và CTA game thành “Chơi”. Phạm vi mở rộng hiện tại được ghi ở mục Mở rộng nút học sinh; giữ nguyên callback và kiểm tra quyền/game khả dụng. Font local mới được scope qua token nút để không đổi bố cục toàn website ngoài phạm vi.

### Quy tắc triển khai còn lại

Đọc `AGENTS.md`, chuẩn này, component/CSS trước khi sửa. Nếu có `ui-ux-pro-max`, dùng để hỗ trợ nhưng ưu tiên TIPY khi khác biệt. Dùng chung token cho màu/font/spacing/radius/shadow và tái sử dụng component nút, thẻ, input, trạng thái. Không tự tạo kiểu nút/bảng màu riêng ở trang, không thêm thư viện lớn khi công cụ hiện có đáp ứng. Giữ chức năng, dữ liệu và nghiệp vụ khi chỉ sửa UI. Cập nhật chuẩn này mỗi khi bổ sung kiểu mới.

## 7. Cổng kiểm tra

Bản xem thử component chạy bằng `npm run dev`, mở `/design-system/tipy/preview.html`. Đây là trang kiểm tra local, dùng cùng component với ứng dụng, không thêm vào nav học sinh và không gọi backend.

- Điện thoại và máy tính: dễ đọc, dấu tiếng Việt không bị cắt, không tràn ngang, vùng bấm đúng kích thước, gap đủ rộng.
- Tương phản chữ và focus; kiểm tra normal/pressed/focus/loading/disabled và hoạt động Tab/Enter/Space.
- Tôn trọng giảm chuyển động; không hiệu ứng lặp trên nút.
- Kiểm tra trạng thái tải, trống, lỗi và thành công trong luồng liên quan; không đổi quyền lớp hoặc khả năng mở game.
- Build và test liên quan; báo ngắn gọn phần đã đổi, đã kiểm tra và chưa kiểm tra được.

## Mở rộng nút học sinh

TipyButton được dùng cho CTA trang chủ, kho game, bắt đầu/chơi lại/tiếp tục, đổi cài đặt, xác nhận âm thanh, lưu nhân vật và đăng nhập/đăng ký/đăng xuất. Giữ nguyên callback, điều kiện disabled và type submit của form. Nút quản trị, chọn phím, switch và bộ lọc không nằm trong đợt này.

Component nhận icon là component Lucide (mặc định Rocket hoặc Gamepad2 theo variant) và emphasis="secondary" cho hành động phụ. Kiểu phụ dùng nền trắng/kem, chữ và viền theo màu vai trò hiện có; không thêm bảng màu. Loading vẫn chặn thao tác, aria-busy và nhãn rõ. Đặt khoảng cách tối thiểu 12 px giữa các CTA trong dialog và cho hàng bắt đầu game tự xuống dòng ở màn hẹp.

## Module Bé chinh phục bàn phím

- Bản đồ dùng ảnh đảo phiêu lưu do chủ dự án cung cấp làm giao diện chính; các vùng nội dung dùng nền kem/trắng, font Nunito 19 px, tiêu đề 28–36 px và TipyButton chung. Bài khóa có chữ “Chưa mở” cùng icon khóa; bài trải nghiệm mở sẵn có nhãn rõ. Cả 5 thế giới có nội dung; thư viện mở sau đủ 30 màn.
- Không dùng luật mất mạng hay thua sau sáu lần sai của Chữ rơi. Khuyến khích thử lại, hiển thị độ chính xác, thời gian và sao; không so sánh công khai học sinh.
- Bàn phím cảm ứng dùng lại Keyboard, có viền chỉ phím đích. Phím trong module tối thiểu 48 × 48 px; vùng bàn phím cuộn riêng ở máy hẹp, không kéo tràn trang. Văn bản nhập bằng textarea thật, hỗ trợ bộ gõ hệ điều hành và composition.
- Không thêm animation lặp. Dùng loading chung và thông báo lỗi có nút thử lại; không giả báo lưu thành công khi backend lỗi.

### Mở rộng hành trình

- Các góc Bản đồ, Tiến bộ, Từ vựng chỉ mount góc đang xem. Nút dùng TipyButton; bảng Telex dùng disclosure native, summary cao tối thiểu 48 px.
- Huy hiệu học tập luôn có chữ “Đã nhận” hoặc điều kiện; không chỉ đổi màu. Kho báu, bộ sưu tập sticker và chế độ săn kho báu đã bỏ; chưa triển khai store. Sao chỉ theo dõi tiến độ, không hiển thị thêm một loại tiền riêng. Sticker chữ trong thử thách là tài nguyên hiển thị bài học.
- Xe chỉ di chuyển khi hoàn thành một lượt đúng, không chạy hiệu ứng liên tục. Không gây áp lực thời gian. Hồ sơ hiển thị 5 bài gần đây và chứng nhận khi đủ 30 màn.
- Báo cáo giáo viên là bảng riêng, có vùng cuộn bàn phím trên máy hẹp, loading/lỗi/thử lại rõ. Báo cáo không xuất hiện với học sinh; quyền còn được kiểm tra ở backend.

### Sao của bạn và bản đồ căn giữa

- AccountPoints là tên component kỹ thuật giữ tương thích, hiển thị **Sao của bạn** từ sổ thưởng server; không cộng điểm các game, không quy đổi điểm cũ. Nhóm tài khoản/avatar/sao nằm cột cuối bên phải dù không có Lớp học; điện thoại xuống hàng trong cùng nhóm, không tràn ngang.
- Mỗi mã bài ổn định của Bé chinh phục bàn phím nhận tối đa 3 sao: lượt hợp lệ chỉ cộng `max(0, sao lượt mới − sao đã thưởng)`. Bằng/thấp hơn không cộng, cao hơn nhận chênh lệch; đủ 3 vẫn được luyện. Kết quả nêu “Nhận thêm … sao”, kèm “Chưa vượt thành tích cũ” nếu không tăng hoặc “Đã nhận đủ 3 sao” khi đủ. Tiến độ phân biệt sao tốt nhất với sao bài học đã nhận. Dữ liệu cũ giữ số sao thực thưởng trong ledger, không tự cấp bù theo best_stars; bài legacy 0 chỉ nhận theo lượt hợp lệ mới. Khách chỉ chơi thử, không nhận sao tài khoản.
- Chữ rơi có nút Thi đấu tuần: Khó/A–Z theo cấu hình hard-v1 cố định (fall 3, minFall 1, spawn 0,95, minSpawn 0,65, max 10; +10/chữ, 3 mạng, sai lần 6 thua, tăng tốc mỗi 500). Luyện tự do giữ cấu hình giáo viên và không trộn vào bảng tuần. Chỉ kết thúc game_over hợp lệ, điểm >0, thành viên từ khi bắt đầu đến khi ghi/chốt mới đủ điều kiện. Rời/vào lại là kỳ tham gia mới.
- Hai tab lớp đánh số: **1. Sao của bạn** xếp theo tổng sao hiện tại (bài học + sao tặng + thưởng tuần, trừ phần đã reset), cùng số sao ở tài khoản và quản lý; **2. Chữ rơi · Khó** dùng điểm tốt nhất hợp lệ trong tuần, không bị ảnh hưởng bởi tặng/reset sao. Bảng sao hòa thì số bài hoàn thành cao hơn → user_id ổn định; bảng Chữ rơi hòa thì chính xác cao hơn → đạt sớm hơn → user_id. Chỉ hiển thị thứ hạng, avatar, tên và sao/điểm; tuần dùng nhãn ngày ngắn và nút Trước/Sau. Tuần thứ Hai 00:00 đến thứ Hai kế tiếp 00:00 theo Asia/Ho_Chi_Minh. Giải thích chuyển vào Hướng dẫn, không đưa mã cấu hình vào giao diện. Sao làm mới sau thao tác và khi quay lại tab; không polling khi trang đứng yên.
- Unique nguồn thưởng và transaction SQL chống gửi lại/hai tab/chốt lại. Tổng sao là SUM(amount − reset_amount) trong sổ thưởng, không có bộ đếm rời. Giữ amount để bài học chỉ nhận phần nâng mức, tối đa 3 sao/bài. Cron backend chốt 00:05 hằng ngày giờ Việt Nam, gồm tuần kết thúc và các tuần bị bỏ lỡ; không phụ thuộc mở trang. Không tái dựng tuần cũ từ best/latest. Chưa có store.
- Học sinh không có quyền đặt lại tiến độ. Thao tác “Làm lại từ đầu” chỉ trong lịch sử quản trị, được kiểm tra quyền backend và database theo quy tắc bên dưới. Các hàm SQL bảo trì cũ vẫn chỉ service_role được gọi để tương thích.
- Bản đồ ảnh giữ đúng tỉ lệ 1672/941, dùng tọa độ phần trăm trong `adventure.js`. Trên điện thoại, vùng bản đồ cuộn ngang riêng với chiều rộng tối thiểu 960 px; trang không tràn ngang. Chọn màn bằng nhân vật/điểm bấm trên đảo; không dùng nút bảng gỗ hoặc menu chọn màn. Danh sách bài chỉ hiện sau khi chọn màn; điện thoại dùng một cột.

### Bản đồ hai cấp

- Bỏ hoàn toàn phần “Hôm nay mình luyện gì?”, các nút học tiếp/ôn tập/thử hôm nay. Mặc định chỉ mount ảnh đảo và 5 vùng bấm; sau khi chọn mới mount 5–8 bài tương ứng. Thẻ bài hiện trực tiếp trên nền cảnh, giữ nền riêng từng thẻ; không có khung trắng lớn hoặc tiêu đề/mô tả màn phía trên. Kiểu chơi là điều khiển nhỏ có nền đọc rõ, đặt ngoài thẻ.
- “Bản đồ đảo” và “Bản đồ” trên thanh điều hướng về đảo; “Danh sách bài” trở về màn đang học. Trở lại từ một bài chơi giữ thế giới hiện tại, chuyển bài sang thế giới khác cập nhật đúng thế giới. Focus về tiêu đề khi đổi cấp.
- Kiểu chơi Cùng học/Đua xe một mình đặt trong thế giới đã chọn, không còn panel gợi ý riêng. Giữ điều kiện mở khóa và sao thành tích; sao thưởng theo phần tăng thêm ở trên.

### Minh họa phiêu lưu

- `adventure.js` là danh mục chung: tọa độ trên đảo, nền và nhân vật hướng dẫn của năm màn. Nhân vật hướng dẫn độc lập với avatar tài khoản. Sprite dùng `object-fit: contain`, không cắt hoặc kéo méo; không thêm nhãn đè chữ có sẵn trên đảo.
- Chi tiết màn dùng Modal chung có X 48 px, Esc và focus về nút mở. Không có bảng gỗ/menu. Giữ nút về bản đồ và danh sách bài; không rời bài khi đang bắt đầu hoặc lưu kết quả, chuyển màn chờ hàng đợi ghi lượt hiện có.
- Chỉ nền của màn đang xem được mount. Nhân vật bản đồ tải khi đi vào vùng cuộn; PNG được nén lossless, giữ kích thước, alpha và dữ liệu điểm ảnh. `prepare-quest-art.mjs` kiểm tra điểm ảnh không đổi; không đưa ảnh ngoài bộ dùng vào public.
- Kiểm tra riêng bằng `node scripts/check-adventure.mjs`: vùng bấm, khóa/mở, chi tiết/X/Esc, làm bài, tiến độ sau reload và cả năm nền tại 320/768/1440 px. Kịch bản dùng API giả lập, không ghi Supabase thật.

### Phần làm bài năm màn

- Chỉ các bài có `world` 1–5 dùng LessonPlayfield và `playfield.css`. AdventureScene nhận `playing` để dùng nền cả khu vực, không có khung trắng ngoài hoặc nhân vật bên phải. Hàng trên là thời gian/tên bài/Tạm dừng; tiến độ nhỏ gọn, thử thách ở trên, nhân vật màn bên trái phía dưới, bàn phím hoặc ô nhập thật ở giữa, Nghe mẫu/gợi ý/Kiểm tra bên phải. Phím cách nằm dưới bàn phím. Chỉ một nút Bản đồ ngoài góc trái về đảo; kết quả có Danh sách bài để quay lại màn.
- Điều khiển/đồng hồ/chấm bài/IME/lưu và sao vẫn thuộc LessonPlayer. Không đổi lesson ID, dữ liệu bài, engine hoặc quy tắc thưởng. Giữ mô tả bài (kể cả hướng dẫn không nhập thông tin cá nhân thật). Tạm dừng khóa nhập và dừng đồng hồ.
- 32 PNG nguyên bản 256 × 256 trong `src/assets/alphabet`, URL đóng gói bởi Vite; chỉ ảnh ký tự đang hiển thị được tải. Ánh xạ dùng chung trong `letter-stickers.js` gồm A–Z, Ă/Â/Ê/Ô/Ơ/Ư; tra đúng hoa/thường và NFC chỉ cho hiển thị. Không tự ghép dấu, không đổi chữ nhập. Thiếu ảnh/lỗi tải dùng chữ Nunito đầy đủ dấu; danh sách thiếu ở README cạnh ảnh. Từ/câu không ghép thành dãy sticker.
- CSS chỉ scope `.quest-play-scene`/`.quest-playfield`. Điện thoại giữ phím 48 px, bàn phím cuộn riêng, không tràn trang; ô nhập thật đủ lớn, điều khiển xuống hàng. Trong bố cục này tạm ẩn lớp nhân vật đồng hành nổi để tránh che bài; không đổi tùy chọn đã lưu, avatar hoặc nhân vật hướng dẫn màn.
- Toàn bộ Từ vựng (`world: 0`), danh sách 9 chủ đề và phần làm bài của nó giữ nhánh giao diện cũ. Không áp dụng class mới hoặc sticker mới. Kiểm tra 30 bài/5 màn và 9 chủ đề ở 320/768/1440 bằng `scripts/check-lesson-playfield.mjs`; API giả lập, không trao sao thật. Giọng đọc thật phụ thuộc thiết bị có giọng tiếng Việt.

### Thao tác giáo viên và hướng dẫn lớp

- Lịch sử học sinh có “Làm lại từ đầu”: chọn trò chơi, gõ đúng `accept` mới xác nhận. Chỉ admin (vai trò giáo viên hiện có) được gọi API/RPC. Xóa kết quả, tiến độ, sao thành tích, lượt đang dở và sao bài học của trò đó; sau đó nhận lại theo phần tăng thêm, tối đa 3 sao/bài. Giữ thời gian tích lũy, tài khoản, nhân vật, lớp, game khác, sao tặng và thưởng tuần đã chốt. Kết quả thi đấu chưa chốt của Chữ rơi được xóa khi đặt lại Chữ rơi. Lượt cũ mất hiệu lực.
- “Tặng sao” ở quản lý học sinh: số nguyên dương, lời nhắn tùy chọn tối đa 240 ký tự. Sổ thưởng lưu người tặng/nhận, số sao, thời điểm và lời nhắn; khóa yêu cầu chống cộng trùng. Sao tặng (kể cả dữ liệu cũ) tính vào tổng và bảng sao lớp; điểm Chữ rơi giữ riêng.
- “Reset sao” khác “Làm lại từ đầu”: chỉ đưa số dư bài học/tặng/tuần đã nhận về 0, giữ tiến độ, kết quả và mức sao đã thưởng từng bài. Bài 3 sao không nhận lại, bài 2→3 chỉ cộng 1. Dialog ghi tên/tên đăng nhập/số sao hiện tại và tác động; yêu cầu đúng `accept` ở client và backend. Lưu biên nhận người reset, học sinh, giờ và số sao trước/sau; sao mới cộng bình thường.
- Top thành tích giữ hai tab đánh số, chỉ thứ hạng, ảnh, tên và sao/điểm. Tuần hiện dạng `09/11–15/11`. Tách “Chưa có học sinh”, “Chưa có thành tích” và lỗi tải có thử lại. Nút Hướng dẫn thay làm mới thủ công; modal chung có X/Esc, giải thích ngắn theo quy tắc thật. Cập nhật tự động sau thao tác và đổi lớp vẫn giữ.
- Mỗi thao tác giáo viên dùng một mã yêu cầu ổn định khi thử lại; database ghi thay đổi và biên nhận cùng transaction. Không thử đặt lại hoặc tặng sao trên tài khoản thật.

## Nhân vật dùng chung

### Người bạn đồng hành

- Thông báo học sinh dùng chung nguồn `src/features/notifications/useNotifications.js` cho bảng, chuông và lời nhắc. Chỉ tự mở trên trang chủ; đang chơi chỉ đổi dấu báo. Bảng dùng Modal chung (X/Esc, focus trả về), thẻ/token và TipyButton “Xem bài”; chuông Lucide tròn 56 px ở dưới trái, dịch tránh nhân vật/khu vực chơi hoặc về luồng trang nếu không còn chỗ trống. Badge có số và nhãn truy cập, không chỉ màu. Lịch sử rỗng ghi “Em chưa có thông báo mới.”
- Đóng bảng mới đánh dấu các thông báo đã trình bày bằng một lô; lịch sử lưu ở server và phân trang 20 mục. Không gọi lại API khi mở/đóng lịch sử đã tải. Thông báo bài kiểm tra có tên bài và giờ mở theo giờ Việt Nam; “Xem bài” đi qua API kiểm tra quyền hiện tại, không tự bắt đầu lượt. Quà tặng ghi “Thầy Hùng tặng em N sao!”, giữ xuống dòng lời nhắn. Reset/xóa/trừ sao không tạo thông báo.
- Lời nhắc chữ xuất hiện 2,5 giây sau khi đóng bảng mới, chỉ khi nhân vật đang hiện và không chơi/không ẩn tab. SQL cấp quyền nói một lần theo tài khoản + notification_id, hai tab không phát lại; xem lịch sử không nói. Dùng các nhóm notification trong `companion-speech.js`, nhiều sự kiện gộp một câu, không xếp hàng và không thêm âm thanh/giọng đọc. Đóng khi nhân vật ẩn vẫn lưu đã trình bày, không phát bù lịch sử sau khi hiện lại.
- Tên giáo viên hiển thị là **Thầy Hùng** từ `src/game/teacher.js`; không sửa username, user_id hoặc thông tin dùng xác thực.

- Lời thoại nguyên văn nằm trong `src/characters/companion-speech.js`, nhóm theo sự kiện thật của game. Hiện 2,5 giây, không lặp liên tiếp, không xếp hàng; phản hồi gõ cách tối thiểu 9 giây, sự kiện quan trọng ưu tiên thay câu phụ. Chữ 18 px đậm, nền kem/viền xanh ngọc, pointer-events none và dưới modal. Tự đổi phía theo mép màn hình; nếu không còn chỗ cạnh nhân vật mà không đè gameplay/nút, tạm không hiện câu đó. Ẩn bạn dọn luôn lời thoại và timer/listener. Nghỉ khi tạm dừng hoặc không thao tác 2 phút. Không thêm giọng đọc.
- Kích thước nổi 60–160%, mặc định 100% tương ứng 96/72 px; luôn giới hạn visual viewport. Bảng kích thước ở phải danh sách trên máy tính, dưới danh sách trên điện thoại, dùng chung một vùng cuộn; footer lưu/ẩn hiện giữ cố định. Kéo thanh chỉ xem trước, Lưu nhân vật thành công mới lưu kích thước; đóng/hủy khôi phục kích thước cũ. Cài đặt vẫn cục bộ theo tài khoản như cơ chế hiện có, không ghi database theo từng chuyển động.

- Dùng cùng mã/ảnh nhân vật đã lưu; không lấy bản chọn thử trong modal. Một Companion trong layout học tập (và cùng component trong layout quản trị), giữ nguyên DOM khi chuyển màn trong App. Avatar tải theo tài khoản được gắn userId trước khi hiển thị để không lẫn người dùng.
- Ảnh contain nền trong suốt, mặc định góc dưới phải, 96 px trên máy tính/72 px trên điện thoại. Chỉ nút nhân vật nhận pointer; z-index 600 dưới modal 1000, không tạo overlay, không animation lặp.
- Kéo bằng Pointer Events và pointer capture; chỉ chuột trái/cảm ứng chính. Chặn kéo ảnh/chọn văn bản chỉ tại nhân vật. Phím mũi tên dịch 12 px khi focus; không phát phím vào game. Vị trí chuẩn hóa 0–1 để luôn nằm trong visual viewport sau resize/xoay.
- Dùng load/save hiện có, khóa `tipy-companion:<userId>` trên trình duyệt; không dùng lại tùy chọn tài khoản khác. Chỉ ghi vị trí khi thả kéo hoặc kết thúc phím mũi tên, không ghi mỗi lần di chuyển. Tùy chọn hiển thị ghi ngay khi bấm Ẩn bạn/Hiện bạn. Không đổi avatar khi ẩn và không thêm API/database cho cài đặt cục bộ.
- Footer nhân vật chứa Lưu nhân vật và Ẩn bạn/Hiện bạn (icon + chữ), có thể xuống hàng trên máy hẹp; khách cần đăng nhập để dùng người bạn đã lưu. Kiểm tra footer ở cả điện thoại ngang và dọc bằng check-characters; hành vi kéo/ẩn/đổi tài khoản bằng check-companion.

Danh mục duy nhất src/characters/catalog.js dùng 36 PNG nguyên bản trong public/characters; không dùng emoji con giáp. Avatar cạnh tài khoản là nút 56 px, tên truy cập “Chọn nhân vật”. Hộp chọn dùng radio, ảnh contain đúng tỉ lệ, nhãn ngắn và dấu “Đang chọn”, TipyButton xác nhận. Khách được xem, đăng nhập trước khi lưu. Dùng chung Avatar cho header, hồ sơ, lớp và game; ảnh danh mục chỉ tải khi mở hộp, dùng lazy.

Modal chọn nhân vật dùng header cố định trong khung với nút X 48 × 48 px; chỉ phần nội dung cuộn, ẩn thanh cuộn nhưng giữ chuột/cảm ứng/bàn phím. X và Esc đóng, bỏ bản chọn chưa lưu. Nút lưu đặt trong footer không cuộn ở đáy modal, bên ngoài vùng danh sách cuộn, luôn nhìn thấy; có nền rõ, viền phân cách và đệm safe area. Danh sách chừa đệm cuối 24 px để hàng cuối không bị che. Âm thanh/Tài khoản ẩn thanh cuộn bằng lớp tipy-scrollbar-hidden, giữ overflow-y: auto và khóa cuộn trang qua Radix; chỉ một vùng cuộn trong mỗi modal.

## Áp dụng toàn website

### Bài kiểm tra

- Mục Bài kiểm tra ở sau Lớp học nếu có, nếu không thì sau Gõ chữ. Nhóm tài khoản/avatar/sao luôn ở cột cuối bên phải; dưới 1000 px xuống hàng riêng, dưới 680 px các mục điều hướng chia hai cột, giữ vị trí ổn định dù ẩn Lớp học.
- Học sinh dùng danh sách → giới thiệu → Bắt đầu/Tiếp tục → các phần → Nộp bài. Hiện Chưa làm/Đang làm/Đã nộp; bài chưa hoàn thành có modal xác nhận nộp. Không có bảng điểm chung khác đơn vị hoặc sao luyện tập trong kết quả kiểm tra.
- Công cụ giáo viên dùng cùng TipyButton, Modal, token và form hiện có, nút gọn 48 px. Kho nội dung đọc 327 mục từ 39 bài/chủ đề thực, sắp theo Màn → Bài → Nội dung; không sửa Từ vựng. Chọn bằng Set mã mục, giữ qua tìm kiếm/thu gọn/trang chọn người nhận; nút chọn tất cả ghi rõ phạm vi (cả kết quả lọc đang thu gọn hoặc toàn màn).
- Xem trước lưu nháp và mở bản tổng hợp; Chỉnh sửa giữ lựa chọn; Gửi bài riêng chỉ khi có phần và người nhận. Đề đã gửi có Tạo bản mới, không chỉnh trực tiếp. Nơi nhận là các thành viên tại thời điểm gửi và các học sinh chọn riêng; học sinh nhận qua lớp cần còn là thành viên lớp đang hoạt động. Quyền quản lý hiện tại là role admin dùng chung với giáo viên.
- Mỗi lượt có checkpoint riêng; hiện Đang lưu/Đã lưu/lỗi rõ, lỗi không được báo thành danh sách trống. Lỗi ghi tạm dừng engine, cho thử lại hoặc mở dữ liệu mới. Tái sử dụng LessonPlayer và TypingGame bằng adapter; không gọi start/progress/quest_finish luyện tập trong chế độ này. Bàn phím, IME, pause và cấu hình được giữ; sao/điểm tuần không thay đổi.
- Kiểm tra trọn luồng qua `scripts/check-assessments.mjs` bằng API thật và SQL trên PGlite riêng, ở 320/768/1440. Không tạo đề hoặc gửi đề thử vào Supabase thật. Giọng đọc/thiết bị thật và tải lớp đông cần kiểm chứng riêng.

### Xóa vĩnh viễn lớp

Chỉ lớp đã lưu trữ có nút Xóa vĩnh viễn cạnh Khôi phục lớp. Dùng TipyButton với lớp chung `tipy-button--danger`, modal xác nhận tên lớp chính xác, nêu dữ liệu mất và không thể khôi phục. Khóa gửi trùng/đóng khi đang xóa. Nếu database đã xóa nhưng Storage chưa dọn hết, hiển thị đúng trạng thái và nút Dọn tệp còn lại, giữ sau reload.

### Quản lý học sinh

- Hai bảng học sinh/thành viên dùng phân trang chung, tối đa 7 tài khoản/trang; có tổng số phù hợp, số trang, Trước/Sau và focus bàn phím. Lọc/tìm/sắp xếp đặt ngoài bảng; đổi bộ lọc về trang 1.
- Checkbox chọn tất cả chỉ tác động trang đang xem, đổi trang/bộ lọc bỏ chọn; số đã chọn ghi rõ “trên trang này”. Hiển thị riêng tình trạng trong lớp đang chọn và danh sách đầy đủ các lớp đang tham gia.
- Nút thao tác quản trị dùng TipyButton gọn 48 px. Xóa tài khoản dùng màu lỗi và nhãn chữ riêng với Khóa/Mở khóa; modal ghi tên/tên đăng nhập, dữ liệu sẽ mất, yêu cầu nhập đúng tên đăng nhập. Không tự đóng hoặc báo thành công khi chưa xác minh xóa.
- Mỗi hàng quản lý học sinh có một nút “Tùy chọn” với Ellipsis. Dùng `src/components/ActionMenu.jsx` và `src/styles/action-menu.css`, TipyButton 48 px/token chung. Menu portal tránh bị bảng cắt ở hàng cuối, tự nằm trong viewport, hỗ trợ mũi tên/Home/End/Enter/Space/Tab, Esc và bấm ngoài; trả focus khi chọn/đóng bằng phím. Mở/đóng không gọi API. Dialog giữ khoảng cách CTA tối thiểu 12 px.

- Font `TIPY Nunito` local nay dùng cho toàn website, thay phạm vi thử nghiệm chỉ trên nút. Nội dung học sinh 19 px, thông tin phụ 16 px, tiêu đề 28–36 px; quản trị dùng 16/14 px để bảng gọn nhưng vẫn dễ đọc.
- Token nền, chữ phụ, viền, nền cam/xanh ngọc nhạt, bo góc và bóng dùng chung ở `src/styles/tipy-tokens.css`. `src/styles/tipy-ui.css` áp dụng các kiểu UI chung theo tên component/màn hình; các CSS cũ giữ bố cục chuyên biệt. Không đặt quy tắc rộng lên canvas, ảnh hay phần chữ rơi.
- Nút thao tác dùng TipyButton ở cả quản trị, quản lý lớp, gửi bài và mở file. Quản trị kế thừa token nút với chiều cao 48 px, chữ 16 px; nút chính học sinh vẫn 64 px. Nút phụ giữ nền kem khi hover để không mất tương phản. Tab có trạng thái hiện tại và focus; form 48 px, nhãn rõ, bảng chỉ cuộn trong vùng riêng.
- Điện thoại: độ khó xếp một cột; bàn phím chọn phím có vùng cuộn riêng và phím 48 px. Bố cục/luật/vị trí chữ trong vùng chơi giữ nguyên. Sơ đồ lớp không cắt tên học sinh.
- Tài khoản chỉ còn Tài khoản/Nhân vật; Lịch sử chơi thuộc mục riêng trong quản trị, chọn học sinh rồi đọc đúng kết quả cao nhất/gần nhất. Bảng ghi rõ giới hạn, không giả dựng dòng lịch sử; kết quả keyboard_quest hiển thị phần trăm chính xác.
- Kiểm tra giao diện bằng `node scripts/check-site-ui.mjs` sau build: trang chủ, kho game, setup/chơi/tạm dừng, bản đồ/bài/tiến bộ, lớp/top, tài khoản/ảnh/âm thanh và toàn bộ tab quản trị, gồm dữ liệu trống, lỗi và thử lại. Dữ liệu trong kịch bản này là giả lập, không ghi vào Supabase thật.
