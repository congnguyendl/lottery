.PHONY: help install install-server install-product build dev serve clean stop

# Biến mặc định
SERVER_PORT ?= 8090
DEV_SERVER_PORT ?= 18888
DEV_CLIENT_PORT ?= 9000

help: ## Hiển thị danh sách các lệnh có sẵn
	@echo "Các lệnh có sẵn:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: install-server install-product ## Cài đặt dependencies cho cả server và product

install-server: ## Cài đặt dependencies cho server
	@echo "📦 Đang cài đặt dependencies cho server..."
	cd server && npm install

install-product: ## Cài đặt dependencies cho product
	@echo "📦 Đang cài đặt dependencies cho product..."
	cd product && npm install

build: ## Build product cho production
	@echo "🔨 Đang build product..."
	cd product && NODE_OPTIONS=--openssl-legacy-provider npm run build
	@echo "✅ Build hoàn tất!"

dev: ## Chạy development mode (product dev server + server backend)
	@echo "🚀 Đang khởi động development mode..."
	@echo "   - Product dev server: http://localhost:$(DEV_CLIENT_PORT)"
	@echo "   - Server backend: http://localhost:$(DEV_SERVER_PORT)"
	cd product && NODE_OPTIONS=--openssl-legacy-provider npm run dev

serve: build ## Build và chạy production mode
	@echo "🚀 Đang khởi động production mode..."
	@echo "   - Server: http://localhost:$(SERVER_PORT)"
	cd product && npm run serve

clean: ## Xóa các file build và node_modules
	@echo "🧹 Đang dọn dẹp..."
	rm -rf product/dist
	rm -rf product/node_modules
	rm -rf server/node_modules
	@echo "✅ Dọn dẹp hoàn tất!"

clean-build: ## Chỉ xóa các file build
	@echo "🧹 Đang xóa file build..."
	rm -rf product/dist
	@echo "✅ Xóa file build hoàn tất!"

stop: ## Dừng tất cả các process đang chạy
	@echo "🛑 Đang dừng các process..."
	@pkill -f "webpack-dev-server" || true
	@pkill -f "node.*server/index.js" || true
	@pkill -f "node.*server/server.js" || true
	@echo "✅ Đã dừng các process!"

restart: stop dev ## Dừng và khởi động lại development mode

