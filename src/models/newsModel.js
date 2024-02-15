const mongoose = require("mongoose");
const helperModal = require("./helper/helperModal");

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    text: { type: String, trim: true, required: true },
    images: {
      type: helperModal.imagesObj,
      required: [true, "News must have at least one image"],
    },
  },
  {
    timestamps: true,
  }
);

const News = mongoose.model("News", newsSchema);
module.exports = News;
