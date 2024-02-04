require("dotenv").config();
const cloudinary = require("./cloudinary");

cloudinary.api
  .create_upload_preset({
    name: "news",
    folder: "news",
    allowed_formats: "jpg, jpeg, png",

    // transformation: [
    //   {
    //     width: 700,
    //     height: 700,
    //     radius: "max",
    //     crop: "thumb",
    //     gravity: "face",
    //   },
    // ],
  })
  .then((uploadResults) => console.log(uploadResults))
  .catch((err) => console.log(err));
