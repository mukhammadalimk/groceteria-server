const mongoose = require("mongoose");
const Product = require("./productModel");

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, "Review can not be empty"],
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, "Review must have a rating"],
      min: [0.5, "Rating should be above 0.5"],
      max: [5, "Rating should be below 5"],
    },
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: [true, "Review must belong to a product."],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a user."],
    },
    replies: [
      {
        text: {
          type: String,
          required: [true, "Reply can not be empty"],
          trim: true,
        },
        user: {
          type: mongoose.Schema.ObjectId,
          ref: "User",
          required: [true, "Review must belong to a user."],
        },
        createdAt: { type: Date, required: true },
        updatedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Restricting users from writing multiple reviews on product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Populating reviews with user
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user",
    select: "name photo username",
  });
  this.populate({
    path: "replies.user",
    select: "name photo username role",
  });
  next();
});

// This is for calculating ratingsAverage and ratingsQuantity for products
reviewSchema.statics.calcAverageRatings = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId },
    },
    {
      $group: {
        _id: "$product",
        nRating: { $sum: 1 },
        avgRating: { $avg: "$rating" },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingsQuantity: 0,
    });
    await Product.updateOne(
      { _id: productId },
      { $unset: { ratingsAverage: "" } }
    );
  }
};

// This is executed after document is saved into the database
reviewSchema.post("save", function () {
  // this points to current review
  // this.constuctor points to current model
  this.constructor.calcAverageRatings(this.product);
});

reviewSchema.post(/^findOneAnd/, async (doc) => {
  await doc.constructor.calcAverageRatings(doc.product);
});

const Review = mongoose.model("Review", reviewSchema);
module.exports = Review;
