/**
 * Cài đặt giải thưởng
 * type: Định danh duy nhất, 0 là placeholder mặc định cho giải đặc biệt, các giải khác không thể sử dụng
 * count: Số lượng giải thưởng
 * title: Mô tả giải thưởng
 * text: Tiêu đề giải thưởng
 * img: Đường dẫn hình ảnh
 */
const prizes = [
  {
    type: 0,
    count: 1000,
    title: "",
    text: "Giải đặc biệt"
  },
  {
    type: 1,
    count: 2,
    text: "Giải nhất",
    title: "Quà tặng bí mật",
    img: "../img/secrit.jpg"
  },
  {
    type: 2,
    count: 5,
    text: "Giải nhì",
    title: "Mac Pro",
    img: "../img/mbp.jpg"
  },
  {
    type: 3,
    count: 6,
    text: "Giải ba",
    title: "Huawei Mate30",
    img: "../img/huawei.png"
  },
  {
    type: 4,
    count: 7,
    text: "Giải tư",
    title: "Ipad Mini5",
    img: "../img/ipad.jpg"
  },
  {
    type: 5,
    count: 8,
    text: "Giải năm",
    title: "Máy bay không người lái DJI",
    img: "../img/spark.jpg"
  },
  {
    type: 6,
    count: 8,
    text: "Giải sáu",
    title: "Kindle",
    img: "../img/kindle.jpg"
  },
  {
    type: 7,
    count: 11,
    text: "Giải bảy",
    title: "Tai nghe Bluetooth Edifier",
    img: "../img/edifier.jpg"
  }
];

/**
 * Số lượng giải thưởng mỗi lần rút tương ứng với prizes
 */
const EACH_COUNT = [1, 1, 5, 6, 7, 8, 9, 10];

/**
 * Nhận diện tên công ty trên thẻ
 */
const COMPANY = "----";

module.exports = {
  prizes,
  EACH_COUNT,
  COMPANY
};
