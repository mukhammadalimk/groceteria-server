const catchAsync = require("../utils/catchAsync");
const cloudinary = require("../utils/cloudinary");

// Middleware for uploading photo for users
const uploadUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  try {
    await cloudinary.uploader.destroy(req.user.id);

    const result = await cloudinary.uploader.upload(req.file.path, {
      upload_preset: "users",
      public_id: req.user.id,
    });

    // We will have access to this in the updateMe controller to put the link into the database
    req.file.filename = result.secure_url;

    next();
  } catch (err) {
    return next(new ErrorClass(err.message, 400));
  }
});

module.exports = {
  uploadUserPhoto,
};
