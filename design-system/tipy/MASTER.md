# TIPY STEM — chuẩn giao diện dùng chung

Nguồn yêu cầu: Custom instructions của Project “Web game Tipy”, do chủ dự án cung cấp trong chat. Đọc cùng `AGENTS.md` trước mọi thay đổi UI. Giữ nguyên các hướng dẫn kỹ thuật ở `ARCHITECTURE.md` và `BACKEND.md`; đây là chuẩn thiết kế, không thay đổi quyền hoặc dữ liệu.

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

- Bản đồ dùng thẻ nền kem/trắng, font Nunito 19 px, tiêu đề 28–36 px và TipyButton chung. Bài khóa có chữ “Chưa mở” cùng icon khóa; bài trải nghiệm mở sẵn có nhãn rõ. Cả 5 thế giới có nội dung; thư viện mở sau đủ 30 màn.
- Không dùng luật mất mạng hay thua sau sáu lần sai của Chữ rơi. Khuyến khích thử lại, hiển thị độ chính xác, thời gian và sao; không so sánh công khai học sinh.
- Bàn phím cảm ứng dùng lại Keyboard, có viền chỉ phím đích. Phím trong module tối thiểu 48 × 48 px; vùng bàn phím cuộn riêng ở máy hẹp, không kéo tràn trang. Văn bản nhập bằng textarea thật, hỗ trợ bộ gõ hệ điều hành và composition.
- Không thêm animation lặp. Dùng loading chung và thông báo lỗi có nút thử lại; không giả báo lưu thành công khi backend lỗi.

### Mở rộng hành trình

- Các góc Bản đồ, Tiến bộ, Từ vựng chỉ mount góc đang xem. Nút dùng TipyButton; bảng Telex dùng disclosure native, summary cao tối thiểu 48 px.
- Huy hiệu học tập luôn có chữ “Đã nhận” hoặc điều kiện; không chỉ đổi màu. Kho báu, sticker và chế độ săn kho báu đã bỏ; chưa triển khai store. Sao chỉ theo dõi tiến độ, không hiển thị thêm một loại tiền riêng.
- Xe chỉ di chuyển khi hoàn thành một lượt đúng, không chạy hiệu ứng liên tục. Không gây áp lực thời gian. Hồ sơ hiển thị 5 bài gần đây và chứng nhận khi đủ 30 màn.
- Báo cáo giáo viên là bảng riêng, có vùng cuộn bàn phím trên máy hẹp, loading/lỗi/thử lại rõ. Báo cáo không xuất hiện với học sinh; quyền còn được kiểm tra ở backend.

### Điểm chung và bản đồ căn giữa

- Chỉ một điểm chung của tài khoản trên toàn website, hiển thị bằng AccountPoints cạnh tài khoản và ở trang quản trị. Điểm = tổng điểm cao nhất mỗi game (không cộng snapshot accuracy của keyboard_quest) + 10 × sao tốt nhất mỗi bài học. Top lớp dùng cùng công thức, vẫn giới hạn trong lớp được phép xem.
- Điểm lấy từ server, tự cập nhật sau khi lưu lượt/bài và khi quay lại tab; không dùng số client gửi lên hoặc cộng lặp theo lần chơi. Chưa có store, số dư tiêu dùng hay ví riêng.
- Không có nút Đặt lại hoặc đường API xóa tiến độ cho học sinh. Các hàm SQL bảo trì chỉ service_role được gọi vẫn giữ để tương thích, không có thao tác xóa dữ liệu trong lần sửa này.
- Bản đồ rộng tối đa 960 px, căn giữa. Mỗi thế giới là một ô chữ nhật dùng TipyButton; chỉ hiện bài sau khi chọn thế giới. Ô thế giới và ô bài chia đều 2 cột; ô cuối lẻ căn giữa; điện thoại dưới 620 px còn 1 cột. Tên, tiến độ và nút bài căn giữa, vùng bấm đủ lớn.

### Bản đồ hai cấp

- Bỏ hoàn toàn phần “Hôm nay mình luyện gì?”, các nút học tiếp/ôn tập/thử hôm nay. Mặc định chỉ mount 5 ô thế giới; sau khi chọn mới mount 5–8 bài tương ứng, không render 30 bài ẩn.
- “Các thế giới” trở về danh sách ô; “Bản đồ” trên thanh điều hướng cũng về danh sách này. Trở lại từ một bài chơi giữ thế giới hiện tại, chuyển bài sang thế giới khác cập nhật đúng thế giới. Focus về tiêu đề khi đổi cấp.
- Kiểu chơi Cùng học/Đua xe một mình đặt trong thế giới đã chọn, không còn panel gợi ý riêng. Điều kiện mở khóa, sao và điểm chung giữ nguyên.

## Nhân vật dùng chung

Danh mục duy nhất src/characters/catalog.js dùng 36 PNG nguyên bản trong public/characters; không dùng emoji con giáp. Avatar cạnh tài khoản là nút 56 px, tên truy cập “Chọn nhân vật”. Hộp chọn dùng radio, ảnh contain đúng tỉ lệ, nhãn ngắn và dấu “Đang chọn”, TipyButton xác nhận. Khách được xem, đăng nhập trước khi lưu. Dùng chung Avatar cho header, hồ sơ, lớp và game; ảnh danh mục chỉ tải khi mở hộp, dùng lazy.

Modal chọn nhân vật dùng header cố định trong khung với nút X 48 × 48 px; chỉ phần nội dung cuộn, ẩn thanh cuộn nhưng giữ chuột/cảm ứng/bàn phím. X và Esc đóng, bỏ bản chọn chưa lưu. Nút lưu nằm trong luồng sau danh sách, không sticky/che hàng cuối; có đệm cuối 24–32 px.

## Áp dụng toàn website

- Font `TIPY Nunito` local nay dùng cho toàn website, thay phạm vi thử nghiệm chỉ trên nút. Nội dung học sinh 19 px, thông tin phụ 16 px, tiêu đề 28–36 px; quản trị dùng 16/14 px để bảng gọn nhưng vẫn dễ đọc.
- Token nền, chữ phụ, viền, nền cam/xanh ngọc nhạt, bo góc và bóng dùng chung ở `src/styles/tipy-tokens.css`. `src/styles/tipy-ui.css` áp dụng các kiểu UI chung theo tên component/màn hình; các CSS cũ giữ bố cục chuyên biệt. Không đặt quy tắc rộng lên canvas, ảnh hay phần chữ rơi.
- Nút thao tác dùng TipyButton ở cả quản trị, quản lý lớp, gửi bài và mở file. Quản trị kế thừa token nút với chiều cao 48 px, chữ 16 px; nút chính học sinh vẫn 64 px. Nút phụ giữ nền kem khi hover để không mất tương phản. Tab có trạng thái hiện tại và focus; form 48 px, nhãn rõ, bảng chỉ cuộn trong vùng riêng.
- Điện thoại: độ khó xếp một cột; bàn phím chọn phím có vùng cuộn riêng và phím 48 px. Bố cục/luật/vị trí chữ trong vùng chơi giữ nguyên. Sơ đồ lớp không cắt tên học sinh.
- Tài khoản chỉ còn Tài khoản/Nhân vật; Lịch sử chơi thuộc mục riêng trong quản trị, chọn học sinh rồi đọc đúng kết quả cao nhất/gần nhất. Bảng ghi rõ giới hạn, không giả dựng dòng lịch sử; kết quả keyboard_quest hiển thị phần trăm chính xác.
- Kiểm tra giao diện bằng `node scripts/check-site-ui.mjs` sau build: trang chủ, kho game, setup/chơi/tạm dừng, bản đồ/bài/tiến bộ, lớp/top, tài khoản/ảnh/âm thanh và toàn bộ tab quản trị, gồm dữ liệu trống, lỗi và thử lại. Dữ liệu trong kịch bản này là giả lập, không ghi vào Supabase thật.
