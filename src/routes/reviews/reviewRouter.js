const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  createReview,
  updateReview,
  deleteReview,
  getReview,
  getAllReviews,
  writeReply,
  updateReply,
  deleteReply,
} = require("./reviewController");

const reviewRouter = express.Router({ mergeParams: true });

// All routes that come after this will be protected

reviewRouter.get("/", getAllReviews);

reviewRouter.use(protectRoutes);

reviewRouter.post("/", restrictTo("user"), createReview);

reviewRouter
  .route("/:reviewId")
  .patch(restrictTo("user"), updateReview)
  .delete(restrictTo("user"), deleteReview)
  .get(getReview);

reviewRouter
  .route("/:reviewId/replies")
  .post(restrictTo("user", "admin", "manager"), writeReply);

reviewRouter
  .route("/:reviewId/replies/:replyId")
  .patch(restrictTo("user", "admin", "manager"), updateReply)
  .delete(restrictTo("user", "admin", "manager"), deleteReply);

module.exports = reviewRouter;
