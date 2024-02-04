require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// cloudinary.config({
//   cloud_name: "groceteria",
//   api_key: 557611379817789,
//   api_secret: "hwJZCZCwtHEach81fDYnTSMz47w",
// });

module.exports = cloudinary;
