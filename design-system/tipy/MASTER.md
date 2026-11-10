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
