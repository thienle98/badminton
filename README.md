# Sổ Thu Chi Sân Cầu

Web quản lý thu chi hằng tháng cho team cầu lông: điểm danh từng buổi, số quả cầu, ai đã chuyển khoản, quỹ đầu tháng, mua cầu, chi phí khác, quyết toán hoàn/thu thêm và thống kê.

Web tĩnh, không cần server. Chạy trên GitHub Pages; dữ liệu là một file `data.json` nằm ngay trong repo.

## Chức năng

- **Đăng nhập và phân quyền**: Quản trị (toàn quyền, quản lý tài khoản, đơn giá), Thủ quỹ (nhập buổi đánh, thu chi), Thành viên (chỉ xem).
- **Buổi đánh**: tự sinh lịch theo ngày cố định (mặc định Thứ 3, 5, 7). Mỗi buổi: trạng thái Đánh / Nghỉ / Pass sân, số quả cầu, thành viên cố định có mặt, vãng lai cố định (nam 45k, nữ 40k), vãng lai ngoài (nam 50k, nữ 45k), ai đã chuyển / chưa trả, ghi chú.
- **Thu chi**: tiền sân nhập đầu tháng, đóng quỹ đầu tháng (đánh dấu ai đã đóng), mua cầu (số ống, tiền, ai trả), chi phí khác, kho cầu (tồn tháng trước chuyển sang tự động).
- **Quyết toán**: (Tiền sân + mua cầu + chi khác − thu vãng lai − thu pass sân) ÷ số thành viên cố định = phần mỗi người gánh. Ai góp nhiều hơn (đóng quỹ, tự mua cầu…) được hoàn phần dư; ai góp ít hơn đóng thêm.
- **Thống kê**: góp và gánh theo thành viên, hoàn/thu thêm, thu chi qua các tháng, số cầu mỗi buổi, số buổi tham gia, luỹ kế.
- **Thành viên**: thêm / sửa / ngừng / xoá thành viên cố định và vãng lai cố định.

## Dữ liệu được lưu thế nào

1. Mọi người mở web sẽ đọc `data.json` mới nhất từ repo.
2. Thủ quỹ / quản trị sửa trên web: thay đổi lưu ngay trên trình duyệt.
3. Nếu đã nhập token GitHub (Cài đặt → Lưu & đồng bộ), web tự ghi `data.json` lên repo sau vài giây. Không có token thì dữ liệu chỉ nằm trên máy đó (có nút tải file sao lưu).

Token: GitHub → Settings → Developer settings → Fine-grained tokens → chọn đúng repo này, quyền **Contents: Read and write**. Token chỉ lưu trong trình duyệt của người nhập, không ghi vào repo.

## Tài khoản mẫu

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| admin | admin123 | Quản trị |
| tung | 123456 | Thủ quỹ |
| dat | 123456 | Thành viên |

Đổi mật khẩu ngay sau khi đăng nhập. Lưu ý: đăng nhập kiểm tra trên trình duyệt và `data.json` công khai cùng repo, nên đây là phân vai trong team, không phải bảo mật thật.

## Chạy thử trên máy

```bash
python3 -m http.server 8000   # rồi mở http://localhost:8000
```

`node scripts/seed.mjs > data.json` tạo lại dữ liệu mẫu (tháng 10/2026 lấy từ sheet tracking).
