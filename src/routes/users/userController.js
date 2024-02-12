const User = require("../../models/userModel");
const catchAsync = require("../../utils/catchAsync");
const ErrorClass = require("../../utils/errorClass");
const Product = require("../../models/productModel");
const {
  getCompareOrWishList,
  addToCompareOrWishlist,
  removeFromCompareOrWishlist,
} = require("../../controllers/handlerFactory");

// This function does not allow user to update their role to 'admin'
const filterBody = (obj, ...alowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (alowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};

// Thise are for admin
const getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    status: "success",
    results: users.length,
    data: users,
  });
});

const makeUserAdmin = catchAsync(async (req, res, next) => {
  const userRole = req.body.role;

  if (userRole === undefined || req.body.userId === undefined) {
    return next(new ErrorClass("Please include required properties", 404));
  }

  const user = await User.findByIdAndUpdate(
    req.body.userId,
    { role: userRole },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({
    status: "success",
    data: user,
  });
});

// These are for users
const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select(
    "+status -wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
  );

  if (!user) return next(new ErrorClass(`No user found with that id`, 404));

  res.status(200).json({
    status: "success",
    user,
    token: req.token,
  });
});

const getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

const updateMe = catchAsync(async (req, res, next) => {
  // This removes the falsy values from req.body but does not mutate the req.body
  const filteredObject = Object.entries(req.body).reduce(
    (a, [k, v]) => (v ? ((a[k] = v), a) : a),
    {}
  );

  // 1) Send error if user tries to update password in this route
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new ErrorClass(
        `This route is not for updating password. Please use /updateMyPassword`,
        400
      )
    );
  }

  // 2) Filtering out unwanted field names that are not allowed to be updated
  const filteredBody = filterBody(
    req.body,
    "name",
    "email",
    "username",
    "addresses",
    "cardInfo",
    "phoneNumber"
  );
  if (req.file) {
    filteredBody.photo = req.file.filename;
    filteredObject.photo = req.file.filename;
  }

  // 3) Update user data based on if phoneNumber is empty or has value
  let user;
  if (req.body.phoneNumber === "") {
    await User.updateOne(
      { _id: req.user.id },
      {
        $unset: { phoneNumber: "" },
      }
    );
    user = await User.findByIdAndUpdate(req.user.id, filteredObject, {
      new: true,
      runValidators: true,
    }).select(
      "+status -wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
    );
  } else {
    user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true,
    }).select(
      "+status -wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
    );
  }

  return res.status(200).json({
    status: "success",
    user: user,
  });
});

const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate({ _id: req.user.id }, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// WISHLIST CONTROLLERS
const getWishlist = getCompareOrWishList(User, "wishlisted");
const addToWishlist = addToCompareOrWishlist(User, Product, "wishlisted");
const removeFromWishlist = removeFromCompareOrWishlist(
  User,
  Product,
  "wishlisted"
);

// COMPARE CONTROLLERS
const getCompare = getCompareOrWishList(User, "compare");
const addToCompare = addToCompareOrWishlist(User, Product, "compare");
const removeFromCompare = removeFromCompareOrWishlist(User, Product, "compare");

// These are only for development process
const createUser = catchAsync(async (req, res, next) => {
  const user = await User.create(req.body);

  res.status(201).json({
    status: "success",
    data: user,
  });
});

const deleteUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.userId);

  res.status(204).json({
    status: "success",
    data: null,
  });
});

const updateUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(req.params.userId, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: user,
  });
});

module.exports = {
  getAllUsers,
  getUser,
  createUser,
  deleteUser,
  updateUser,
  updateMe,
  deleteMe,
  makeUserAdmin,
  getMe,
  addToWishlist,
  addToCompare,
  getWishlist,
  getCompare,
  removeFromWishlist,
  removeFromCompare,
};
