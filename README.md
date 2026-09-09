# 飛刀 Flying Dagger

Game gõ pinyin để bắn chữ Hán — clone theo Hanzii, chạy độc lập bằng Vite + React.

## Cách chạy

Mở terminal trong VSCode (Terminal → New Terminal), `cd` vào thư mục này rồi chạy:

```bash
npm install
npm run dev
```

Terminal sẽ in ra một địa chỉ dạng `http://localhost:5173` — mở link đó trên trình duyệt là chơi được.

Yêu cầu máy đã cài **Node.js** (bản 18 trở lên). Kiểm tra bằng `node -v`, nếu chưa có thì tải tại https://nodejs.org.

## Lưu dữ liệu

Kho từ vựng và điểm cao nhất được lưu trong `localStorage` của trình duyệt (khác máy/khác trình duyệt sẽ không đồng bộ với nhau, và xoá cache trình duyệt sẽ mất dữ liệu).

## Build bản deploy

```bash
npm run build
```

Kết quả nằm trong thư mục `dist/`, có thể đem host lên bất kỳ static hosting nào (Vercel, Netlify, GitHub Pages...).

## Đưa lên GitHub Pages (chơi trực tiếp bằng link, không cần cài gì)

Repo này đã có sẵn workflow `.github/workflows/deploy.yml` — chỉ cần đẩy code lên GitHub và bật Pages một lần, mỗi lần push sau đó sẽ tự build & deploy lại.

1. Tạo một repo mới trên github.com (Public hoặc Private đều được), **không** tick "Add a README".
2. Trong thư mục này, chạy:
   ```bash
   git init
   git add .
   git commit -m "Flying Dagger game"
   git branch -M main
   git remote add origin https://github.com/<ten-user>/<ten-repo>.git
   git push -u origin main
   ```
3. Trên GitHub, vào repo → **Settings → Pages** → mục "Build and deployment" → **Source** chọn **GitHub Actions** (không chọn "Deploy from a branch").
4. Vào tab **Actions** của repo, sẽ thấy workflow "Deploy to GitHub Pages" tự chạy (mất khoảng 1 phút). Chạy xong, quay lại **Settings → Pages**, GitHub sẽ hiện link dạng:
   ```
   https://<ten-user>.github.io/<ten-repo>/
   ```
   Mở link đó là chơi được ngay trên trình duyệt, không cần ai cài Node hay chạy lệnh gì.
5. Từ lần sau, mỗi khi `git push` lên nhánh `main`, trang sẽ tự build lại và cập nhật link đó.

Lưu ý: GitHub **không** chạy được code khi bạn chỉ mở file `.jsx` trực tiếp trên github.com (nó chỉ hiển thị source, không render) — bắt buộc phải qua bước build + GitHub Pages ở trên thì mới "chơi trực tiếp" được.

## Sửa/chỉnh game

Toàn bộ logic và giao diện nằm trong `src/App.jsx` — cứ sửa thoải mái, Vite sẽ tự reload khi bạn lưu file (đang chạy `npm run dev`).
