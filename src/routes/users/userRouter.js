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
  getNewAccessToken,
} = require("../../controllers/authController");
const { multerUserPhoto } = require("../../middlewares/commonMiddlewares");
const { uploadUserPhoto } = require("../../middlewares/userMiddlewares");
const reviewRouter = require("../reviews/reviewRouter");

const {
  getAllUsers,
  getUser,
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
  getCustomersStats,
} = require("./userController");
const userRouter = express.Router();

// This is for getting all reviews of one person
userRouter.use("/:userId/reviews", reviewRouter);

// Authentication
userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.get("/new-access-token", getNewAccessToken);
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

// Protect and restrict routes
userRouter.use(protectRoutes);

userRouter.delete("/deleteMe", deleteMe);
userRouter.get("/me", getMe, getUser);

userRouter.get("/:userId", restrictTo("admin"), getUser);
userRouter.get("/stats/customers", restrictTo("admin"), getCustomersStats);

// WISHLIST ROUTES
userRouter.get("/me/wishlisted", getWishlist);
userRouter.patch("/me/wishlisted/add", addToWishlist);
userRouter.patch("/me/wishlisted/remove", removeFromWishlist);

// COMPARE ROUTES
userRouter.get("/me/compare", getCompare);
userRouter.patch("/me/compare/add", addToCompare);
userRouter.patch("/me/compare/remove", removeFromCompare);

module.exports = userRouter;
