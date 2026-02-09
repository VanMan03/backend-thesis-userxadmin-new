const multer = require("multer");
const CloudinaryStorage = require("multer-storage-cloudinary").CloudinaryStorage;
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "destinations",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const upload = multer({ storage });



module.exports = upload;

