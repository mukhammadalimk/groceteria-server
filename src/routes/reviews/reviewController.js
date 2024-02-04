const Review = require("../../models/reviewModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");

exports.getAllReviews = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.params.productId) filter = { product: req.params.productId };
  if (req.params.userId) filter = { user: req.params.userId };

  const reviews = await Review.find(filter);

  return res.status(200).json({
    status: "success",
    results: reviews.length,
    data: reviews,
  });
});

exports.getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.reviewId);

  if (!review) {
    return next(new ErrorClass(`No review found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: review,
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.reviewId);
  // Restricing user from deleting others's reviews
  if (review.user._id.toString() !== req.user._id.toString()) {
    return next(new ErrorClass(`You can not delete others's review`, 403));
  }

  const deletedReview = await Review.findByIdAndDelete(req.params.reviewId);

  if (!deletedReview) {
    return next(new AppError("No review found with that ID", 404));
  }

  return res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  // This is for creating a review on tour without passing manually tour and user ids
  if (!req.body.product) req.body.product = req.params.productId;
  if (!req.body.user) req.body.user = req.user.id;

  const review = await Review.create(req.body);

  return res.status(201).json({
    status: "success",
    data: review,
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const updatingReview = await Review.findById(req.params.reviewId);
  // Restricing user from updating others's reviews
  if (updatingReview.user._id.toString() !== req.user._id.toString()) {
    return next(new ErrorClass(`You can not update others's review`, 403));
  }

  const review = await Review.findByIdAndUpdate(req.params.reviewId, req.body, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    status: "success",
    data: review,
  });
});
