const multer = require("multer");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");

const removeOrAndUploadImages = async (Modal, next, folder, req, type) => {
  // Find the updating product or news
  const updatingItem = await Modal.findById(req.params.id);
  if (!updatingItem)
    return next(new ErrorClass(`No docement found with that id`, 404));

  //  Not deleted images come in the body from the frontend
  let notDeletedImages = req.body.notDeletedImages;

  let deletedImages = updatingItem.images;
  if (type !== "onlyAdd") {
    // Find the deleted image(s)
    for (let i = 0; i < notDeletedImages.length; i++) {
      deletedImages = deletedImages.filter(
        (imgObj) => imgObj.cloudinaryId !== notDeletedImages[i].cloudinaryId
      );
    }
  }

  let images = [];
  try {
    if (type !== "onlyAdd") {
      // Delete images from the cloudinary
      await Promise.all(
        deletedImages.map(async (img) => {
          await cloudinary.uploader.destroy(img.cloudinaryId);
        })
      );
    }

    // It is when user only removes images
    req.body.images = req.body.notDeletedImages;

    // Upload new images to the cloudinary
    if (type === "newAndRemove" || type === "onlyAdd") {
      await Promise.all(
        req.files.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, {
            upload_preset: folder,
          });

          images.push({
            imageUrl: result.secure_url,
            cloudinaryId: result.public_id,
          });
        })
      );

      // Concact all images and put it in req.body.images which updateProduct or updateNews will have access
      req.body.images =
        type === "newAndRemove"
          ? notDeletedImages.concat(images)
          : updatingItem.images.concat(images);
    }
  } catch (err) {
    return next(new ErrorClass(err.message, 400));
  }
};

const updateProductOrNewsImages = (Modal, folder, id) =>
  catchAsync(async (req, res, next) => {
    // If Admin does not update images, this middleware will not be needed.
    if (req.files.length === 0 && req.body.notDeletedImages === undefined) {
      return next();
    }
    // req.body.notDeletedImages comes as string from frontend and we parse it here
    req.body.notDeletedImages = req.body.notDeletedImages
      ? JSON.parse(req.body.notDeletedImages)
      : undefined;

    req.params.id = id === "newsId" ? req.params.newsId : req.params.productId;

    // We have three conditions here
    // 1 - Admin only Removes image(s)
    if (req.files.length === 0 && req.body.notDeletedImages?.length > 0) {
      await removeOrAndUploadImages(Modal, next, folder, req, "onlyRemove");
    }

    // 2 - Admin both Adds new image(s) and Removes image(s)
    if (req.files.length > 0 && req.body.notDeletedImages?.length >= 0) {
      await removeOrAndUploadImages(Modal, next, folder, req, "newAndRemove");
    }

    // 3 - Admin only adds new image(s)
    if (req.files.length > 0 && req.body.notDeletedImages === undefined) {
      await removeOrAndUploadImages(Modal, next, folder, req, "onlyAdd");
    }

    return next();
  });

// Upload news images when creating a new product
const multerStorage = multer.diskStorage({});

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ErrorClass("Not an image! Please upload only images", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

const multerProductOrNewsImages = upload.array("images", 10);
const multerCategoryImage = upload.single("image");
const multerUserPhoto = upload.single("photo");
// const uploadProductImages = upload.fields([{ name: "images", maxCount: 5 }]);

module.exports = {
  updateProductOrNewsImages,
  multerProductOrNewsImages,
  multerCategoryImage,
  multerUserPhoto,
};
