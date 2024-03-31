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
  const users = await User.find().select("+status");

  res.status(200).json({
    status: "success",
    data: users,
  });
});

const getCustomersStats = catchAsync(async (req, res, next) => {
  // { status: { $eq: "active" } }
  const users = await User.find();

  if (users.length === 0) {
    return next(
      new ErrorClass("There are no users to show 'users statistics'.", 404)
    );
  }

  function convertToLocal(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  }

  const sevenDaysBeforeStarMilliseconds =
    new Date(Date.now()).getTime() - 7 * 24 * 60 * 60 * 1000;

  const newCustomers = users.filter(
    (i) =>
      convertToLocal(i.createdAt).getTime() > sevenDaysBeforeStarMilliseconds
  );

  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1;
  const year = dateObj.getUTCFullYear();
  const updatedMonth = month < 10 ? `0${month}` : month;
  const thisMonthStartDate = new Date(`${year}-${updatedMonth}-01`);

  const thisMonthCustomers = users.filter(
    (i) => convertToLocal(i.createdAt) > thisMonthStartDate
  );

  res.status(200).json({
    status: "success",
    data: {
      total: users.length,
      new: newCustomers.length,
      thisMonth: thisMonthCustomers.length,
    },
  });
});

const makeUserManager = catchAsync(async (req, res, next) => {
  const userRole = req.body.role;

  if (userRole === undefined || req.params.userId === undefined) {
    return next(new ErrorClass("Please include required properties", 400));
  }

  await User.findByIdAndUpdate(
    req.params.userId,
    { role: userRole },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).json({ status: "success" });
});

// These are for users
const getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.userId).select(
    "-createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
  );

  if (!user) return next(new ErrorClass(`No user found with that id`, 404));

  res.status(200).json({
    status: "success",
    user,
  });
});

const getMe = (req, res, next) => {
  req.params.userId = req.user.id;
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
      "+status -createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
    );
  } else {
    user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
      new: true,
      runValidators: true,
    }).select(
      "+status -createdAt -updatedAt -__v -passwordChangedAt -resetToken -resetTokenExpires"
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

// // These are only for development process
// const createUser = catchAsync(async (req, res, next) => {
//   const user = await User.create(req.body);

//   res.status(201).json({
//     status: "success",
//     data: user,
//   });
// });

// const deleteUser = catchAsync(async (req, res, next) => {
//   await User.findByIdAndDelete(req.params.userId);

//   res.status(204).json({
//     status: "success",
//     data: null,
//   });
// });

// const updateUser = catchAsync(async (req, res, next) => {
//   const user = await User.findByIdAndUpdate(req.params.userId, req.body, {
//     new: true,
//     runValidators: true,
//   });

//   res.status(200).json({
//     status: "success",
//     data: user,
//   });
// });

module.exports = {
  getAllUsers,
  getUser,
  updateMe,
  deleteMe,
  makeUserManager,
  getMe,
  addToWishlist,
  addToCompare,
  getWishlist,
  getCompare,
  removeFromWishlist,
  removeFromCompare,
  getCustomersStats,
};
