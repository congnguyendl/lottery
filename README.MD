# 🎰 Hệ thống Quay số Trúng thưởng (Lottery System)

Hệ thống quay số trúng thưởng với giao diện 3D hiện đại, hỗ trợ quản lý người dùng, giải thưởng và theo dõi kết quả quay số.

## 📋 Mục lục

- [Tính năng](#tính-năng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Cách sử dụng](#cách-sử-dụng)
- [API Endpoints](#api-endpoints)
- [Cấu hình](#cấu-hình)
- [Docker](#docker)
- [Lưu ý](#lưu-ý)

## ✨ Tính năng

- 🎲 **Quay số 3D**: Giao diện quay số với hiệu ứng 3D mượt mà
- 👥 **Quản lý người dùng**: Import danh sách người tham gia từ file Excel
- 🏆 **Quản lý giải thưởng**: Thêm, sửa, xóa giải thưởng với hình ảnh
- 📊 **Theo dõi kết quả**: Xem danh sách người trúng thưởng theo từng giải
- 🎮 **Điều khiển từ xa**: Điều khiển quay số qua WebSocket
- 📤 **Xuất kết quả**: Xuất kết quả quay số ra file Excel
- 💾 **Lưu trữ dữ liệu**: Tự động lưu dữ liệu vào file, không mất khi restart server

## 📁 Cấu trúc dự án

```
lottery/
├── server/                 # Backend server
│   ├── server.js          # Main server file
│   ├── index.js           # Entry point
│   ├── config.js          # Cấu hình giải thưởng
│   ├── help.js            # Utility functions
│   ├── data/              # Dữ liệu
│   │   └── users.xlsx     # File danh sách người tham gia
│   ├── cache/             # Cache files
│   │   ├── temp.json      # Kết quả quay số
│   │   ├── error.json     # Danh sách người không đến
│   │   └── prizes.json    # Cấu hình giải thưởng đã lưu
│   └── uploads/           # Thư mục upload file
├── product/               # Frontend
│   ├── src/               # Source code
│   │   ├── index.html     # Trang quay số chính
│   │   ├── admin.html     # Trang quản trị
│   │   ├── controller.html # Trang điều khiển
│   │   ├── display.html   # Trang hiển thị kết quả
│   │   └── lottery/       # Module quay số
│   └── dist/              # Build output
├── Makefile               # Make commands
├── docker-compose.yml     # Docker compose config
├── Dockerfile             # Docker image config
└── README.md              # File này
```

## 🔧 Yêu cầu hệ thống

- **Node.js**: >= 12.x
- **npm** hoặc **pnpm**
- **Docker** (tùy chọn, nếu chạy bằng Docker)

## 🚀 Cài đặt

### Cài đặt dependencies

```bash
# Cài đặt cho cả server và product
make install

# Hoặc cài đặt riêng lẻ
make install-server    # Cài đặt dependencies cho server
make install-product   # Cài đặt dependencies cho product
```

### Cài đặt thủ công

```bash
# Cài đặt server dependencies
cd server && npm install

# Cài đặt product dependencies
cd product && npm install
```

## 💻 Cách sử dụng

### Development Mode

Chạy ở chế độ development với hot-reload:

```bash
make dev
```

Hoặc:

```bash
cd product && npm run dev
```

- **Product dev server**: http://localhost:9000
- **Server backend**: http://localhost:18888

### Production Mode

Build và chạy production:

```bash
make serve
```

Hoặc:

```bash
# Build
make build

# Chạy server
cd product && npm run serve
```

Server sẽ chạy tại: **http://localhost:8090** (hoặc port được chỉ định)

### Các lệnh Make khác

```bash
make help          # Xem danh sách lệnh
make build          # Build product
make clean          # Xóa node_modules và dist
make clean-build    # Chỉ xóa dist
make stop           # Dừng tất cả process
make restart        # Dừng và khởi động lại dev mode
```

### Chạy với port tùy chỉnh

```bash
# Server
node server/index.js 8090

# Product (sau khi build)
cd product/dist && node ../../server/index.js 8888
```

## 🔌 API Endpoints

### User Management

- `POST /api/uploadUsers` - Upload danh sách người tham gia (file Excel)
  - Body: `multipart/form-data` với field `file`
  - Response: `{ success: true, count: number }`

- `POST /getUsers` - Lấy danh sách tất cả người tham gia
  - Response: `Array<[mã, họ tên, phòng ban]>`

### Prize Management

- `POST /getPrizes` - Lấy danh sách giải thưởng
  - Response: `{ prizes: Array, cfgData: { EACH_COUNT: Array } }`

- `POST /api/addPrize` - Thêm giải thưởng mới
  - Body: `{ text, title, count, img }`
  - Response: `{ success: boolean }`

- `PUT /api/updatePrize/:type` - Cập nhật giải thưởng
  - Body: `{ text, title, count, img, perDraw? }`
  - Response: `{ success: boolean }`

- `DELETE /api/deletePrize/:type` - Xóa giải thưởng
  - Response: `{ success: boolean }`

- `PUT /api/updatePrizePerDraw/:type` - Cập nhật số lượng quay mỗi lần
  - Body: `{ perDraw: number }`
  - Response: `{ success: boolean }`

- `POST /api/uploadPrizeImg` - Upload hình ảnh giải thưởng
  - Body: `multipart/form-data` với field `file`
  - Response: `{ success: true, url: string }`

### Lottery Operations

- `POST /getTempData` - Lấy dữ liệu tạm (kết quả quay số, người còn lại)
  - Response: `{ cfgData, leftUsers, luckyData }`

- `POST /saveData` - Lưu kết quả quay số
  - Body: `{ type: number, data: Array }`
  - Response: `{ type: string }`

- `POST /errorData` - Lưu danh sách người không đến
  - Body: `{ data: Array }`
  - Response: `{ type: string }`

- `POST /reset` - Reset tất cả dữ liệu quay số
  - Response: `{ type: "success" }`

### Statistics & Export

- `GET /api/stats` - Lấy thống kê
  - Response: `{ totalUsers, luckyUsers, leftUsers, totalPrizes, drawnPrizes, remainingPrizes }`

- `GET /api/winners` - Lấy danh sách người trúng thưởng theo giải
  - Response: `{ success: true, prizes: Array }`

- `POST /export` - Xuất kết quả ra file Excel
  - Response: `{ type: "success", url: "ket-qua-quay-so-so.xlsx" }`

## ⚙️ Cấu hình

### Cấu hình giải thưởng

Chỉnh sửa file `server/config.js`:

```javascript
const prizes = [
  {
    type: 0,              // ID giải (0 = giải đặc biệt)
    count: 1000,          // Số lượng giải
    title: "",            // Mô tả
    text: "Giải đặc biệt", // Tên giải
    img: ""               // Đường dẫn hình ảnh
  },
  // ... các giải khác
];

const EACH_COUNT = [1, 1, 5, 6, 7, 8, 9, 10]; // Số lượng quay mỗi lần
```

**Lưu ý**: 
- Giải thưởng được lưu tự động vào `server/cache/prizes.json` khi thêm/sửa/xóa
- Cấu hình mặc định trong `config.js` chỉ dùng khi chưa có file `prizes.json`

### File dữ liệu

- **Danh sách người tham gia**: `server/data/users.xlsx`
  - Format: Excel với header `[Mã nhân viên, Họ tên, Phòng ban]`
  - File này được tự động cập nhật khi import user mới

- **Kết quả quay số**: `server/cache/temp.json`
- **Danh sách người không đến**: `server/cache/error.json`
- **Cấu hình giải thưởng**: `server/cache/prizes.json`

## 🐳 Docker

### Build Docker image

```bash
./build.sh [tag]
```

### Chạy với Docker

```bash
./dev.sh [tag]
```

### Docker Compose

```bash
docker-compose up -d
```

Server sẽ chạy tại port **28458** (mapped từ 8888 trong container).

## 📝 Lưu ý

### Import User

- Khi import user mới:
  - ✅ Dữ liệu cũ (kết quả quay số, danh sách người không đến) sẽ bị **xóa tự động**
  - ✅ Danh sách user mới được **lưu vào file** `server/data/users.xlsx`
  - ✅ Dữ liệu được **xáo trộn** ngẫu nhiên

### Multi-tenant

- ⚠️ Hiện tại hệ thống là **single-instance**, không hỗ trợ nhiều công ty cùng lúc
- Tất cả người dùng dùng chung một bộ dữ liệu
- Nếu cần hỗ trợ multi-tenant, cần thêm cơ chế phân biệt công ty (companyId, subdomain, v.v.)

### WebSocket

- Hệ thống sử dụng WebSocket để đồng bộ giữa các client
- Khi có thay đổi giải thưởng, tất cả client sẽ được thông báo tự động

### Port Conflicts

Nếu gặp lỗi port đã được sử dụng:

```bash
# Tìm process đang dùng port
lsof -ti:8090

# Dừng process
kill -9 $(lsof -ti:8090)
```

Hoặc dùng lệnh:

```bash
make stop
```

## 📄 License

Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

## 👤 Author

moshang

## 🔗 Links

- Repository: https://github.com/moshang-xc/web-server

