const express = require("express");
const {
  signup,
  login,
  resetPassword,
  forgotPassword,
  updateMyPassword,
  protectRoutes,
  restrictTo,
  logout,
  verify,
  sendVerificationCodeAgain,
  checkResetTokenExist,
  getRefreshToken,
} = require("../../controllers/authController");
const { multerUserPhoto } = require("../../middlewares/commonMiddlewares");
const { uploadUserPhoto } = require("../../middlewares/userMiddlewares");
const reviewRouter = require("../reviews/reviewRouter");

const {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  createUser,
  updateMe,
  makeUserAdmin,
  deleteMe,
  getMe,
  getWishlist,
  getCompare,
  addToCompare,
  addToWishlist,
  removeFromWishlist,
  removeFromCompare,
} = require("./userController");

const userRouter = express.Router();

// This is for getting all reviews of one person
userRouter.use("/:userId/reviews", reviewRouter);

// Authentication
userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.get("/refresh", getRefreshToken);
userRouter.get("/logout", protectRoutes, logout);
userRouter.post("/verify", verify);
userRouter.post("/send-code-again", sendVerificationCodeAgain);

userRouter.post("/forgotPassword", forgotPassword);
userRouter.patch("/resetPassword/:token", resetPassword);
userRouter.get("/checkResetToken/:token", checkResetTokenExist);
userRouter.patch("/updateMyPassword", protectRoutes, updateMyPassword);
userRouter.patch(
  "/updateMe",
  protectRoutes,
  multerUserPhoto,
  uploadUserPhoto,
  updateMe
);

// THIS IS FOR ADMIN
userRouter.route("/").get(protectRoutes, restrictTo("admin"), getAllUsers);
userRouter
  .route("/update-to-admin")
  .patch(protectRoutes, restrictTo("admin"), makeUserAdmin);

// This route is only for development
userRouter.route("/").post(protectRoutes, restrictTo("admin"), createUser);

// Do NOT update passwords with this!
userRouter.route("/:userId").patch(updateUser).delete(deleteUser);

// Protect and restrict routes
userRouter.use(protectRoutes);

userRouter.delete("/deleteMe", deleteMe);
userRouter.get("/me", getMe, getUser);

// WISHLIST ROUTES
userRouter.get("/wishlist", getWishlist);
userRouter.patch("/wishlist/add", addToWishlist);
userRouter.patch("/wishlist/remove", removeFromWishlist);

// COMPARE ROUTES
userRouter.get("/compare", getCompare);
userRouter.patch("/compare/add", addToCompare);
userRouter.patch("/compare/remove", removeFromCompare);

module.exports = userRouter;
