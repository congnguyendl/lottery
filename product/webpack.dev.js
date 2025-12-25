const baseConfig = require("./webpack.config");
const merge = require("webpack-merge");
const path = require("path");

module.exports = merge(baseConfig, {
  devtool: "#eval-source-map",
  devServer: {
    hot: true,
    compress: true,
    port: 9000,
    open: false,
    contentBase: path.join(__dirname, "src"),
    watchContentBase: true,
    proxy: {
      "/api": "http://localhost:18888",
      "/getTempData": "http://localhost:18888",
      "/getUsers": "http://localhost:18888",
      "/saveData": "http://localhost:18888",
      "/errorData": "http://localhost:18888",
      "/export": "http://localhost:18888",
      "/reset": "http://localhost:18888"
    },
    before(app, server, compiler) {
      // Lazy load server to avoid loading issues during webpack config
      try {
        const serve = require("../server/server.js");
        const serverInstance = serve.run(18888, "n");
        
        // Handle server errors gracefully
        if (serverInstance) {
          serverInstance.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              console.warn(`⚠️  Port 18888 đã được sử dụng. Server có thể đã chạy.`);
              console.warn(`   Nếu cần, hãy kill process: kill -9 $(lsof -ti:18888)`);
            }
          });
        }
      } catch (error) {
        console.error("❌ Không thể khởi động server:", error.message);
        console.log("💡 Vui lòng chạy server riêng: cd server && node index.js 18888");
      }
    }
  }
});
