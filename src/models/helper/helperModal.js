module.exports = {
  priceObj: {
    type: Number,
    required: [true, "A product must have a price"],
    // "this" only works in current doc on NEW document creation. It doest not work in .update()
    validate: {
      validator: function (val) {
        return val >= 0;
      },
      message: "Price ({VALUE}) should be above 0.00",
    },
  },

  nameObj: {
    type: String,
    required: [true, "A product type must have a name"],
    trim: true,
  },

  featuresObj: {
    type: String,
    trim: true,
  },

  descriptionObj: {
    type: String,
    required: [true, "A product must have a description"],
    trim: true,
  },

  inStockObj: {
    type: Boolean,
    default: true,
    required: [true, "Availability of a product should be included"],
  },

  weightObj: {
    type: String,
    trim: true,
  },

  brandNameObj: {
    type: String,
    trim: true,
  },

  storeObj: {
    type: String,
    required: [true, "A product must have a store"],
    trim: true,
  },

  imagesObj: [
    {
      imageUrl: { type: String, required: true },
      cloudinaryId: { type: String, required: true },
    },
  ],

  ratingsAverageObj: {
    type: Number,
    min: [0, "A rating must be above 1.0"],
    max: [5, "A rating must be below 5.0"],
    set: (val) => Math.round(val * 10) / 10,
  },

  ratingsQuantityObj: {
    type: Number,
    default: 0,
  },

  addressObj: {
    name: {
      type: String,
      required: [true, "Please provide receiver's name"],
      trim: true,
    },
    phoneNumber: { type: String, required: true },
    city: {
      type: String,
      required: [true, "Please provide receiver's city"],
      trim: true,
    },
    address1: {
      type: String,
      required: [true, "Please provide receiver's address"],
      trim: true,
    },
    address2: { type: String, trim: true },
    postalCode: { type: Number, required: true },
  },
};
