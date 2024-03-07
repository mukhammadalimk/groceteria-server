const mongoose = require("mongoose");
const slugify = require("slugify");
const Category = require("./categoryModel");
const helperModal = require("./helper/helperModal");

const productSchema = new mongoose.Schema(
  {
    name: helperModal.nameObj,
    slug: String,
    price: helperModal.priceObj,
    features: helperModal.featuresObj,
    weight: helperModal.weightObj,
    brandName: helperModal.brandNameObj,
    description: helperModal.descriptionObj,
    discountedPrice: { type: Number, min: 0, default: 0 },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: [true, "A product must belong to a category"],
    },
    store: helperModal.storeObj,
    images: {
      type: helperModal.imagesObj,
      required: [true, "A product must have at least one image"],
    },
    inStock: helperModal.inStockObj,
    ratingsAverage: helperModal.ratingsAverageObj,
    ratingsQuantity: helperModal.ratingsQuantityObj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Document Middleware
productSchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// It is for calculating number of products in a category and save it in category document
productSchema.statics.calcNumOfProductsOfCategory = async function (
  categoryId,
  type
) {
  const category = await Category.findById(categoryId);
  await Category.findByIdAndUpdate(
    categoryId,
    {
      numberOfProducts:
        type === "plus"
          ? category.numberOfProducts + 1
          : category.numberOfProducts - 1,
    },
    { runValidators: true, new: true }
  );
};

// This is executed after document is saved into the database
productSchema.post("save", function () {
  // this points to current review
  // this.constuctor points to current model
  this.constructor.calcNumOfProductsOfCategory(this.category, "plus");
});

// It is when admin deletes a product.
productSchema.post(/^findOneAndDelete/, async (doc) => {
  await doc.constructor.calcNumOfProductsOfCategory(doc.category, "minus");
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
