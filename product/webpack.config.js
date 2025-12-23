const webpack = require("webpack");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = {
  entry: path.join(__dirname, "/src/lottery/index.js"),
  output: {
    path: path.join(__dirname, "/dist"),
    filename: "lottery.js"
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js)$/,
        use: {
          loader: "babel-loader"
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader"
          },
          {
            loader: "postcss-loader"
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.BannerPlugin("Bản quyền thuộc về tác giả, nghiêm cấm sao chép"),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "/src/index.html"),
      filename: "./index.html",
      minify: {
        // Xóa thuộc tính rỗng
        removeEmptyAttributes: true,
        // Nén css
        minifyCSS: true,
        // Nén JS
        minifyJS: true,
        // Xóa khoảng trắng
        collapseWhitespace: true
      },
      hash: true,
      inject: true
    }),
    new CopyWebpackPlugin([
      {
        from: "./src/css",
        to: "./css"
      },
      {
        from: "./src/data",
        to: "./data"
      },
      {
        from: "./src/img",
        to: "./img"
      },
      {
        from: "./src/lib",
        to: "./lib"
      },
      {
        from: "./src/admin.html",
        to: "./admin.html"
      },
      {
        from: "./src/controller.html",
        to: "./controller.html"
      },
      {
        from: "./src/display.html",
        to: "./display.html"
      }
    ])
  ]
};
