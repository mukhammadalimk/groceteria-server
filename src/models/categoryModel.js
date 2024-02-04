const mongoose = require("mongoose");
const slugify = require("slugify");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    image: {
      imageUrl: { type: String, required: true },
      cloudinaryId: { type: String, required: true },
    },
    slug: String,
    numberOfProducts: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // this makes virtual properties to be shown.
    toObject: { virtuals: true },
  }
);

// Products will be virtually populated for category
categorySchema.virtual("products", {
  ref: "Product",
  foreignField: "category",
  localField: "_id",
});

// (Mongoose middleware) DOCUMENT MIDDLEWARE: 'save' runs before .save(). and .create()
categorySchema.pre("save", function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
