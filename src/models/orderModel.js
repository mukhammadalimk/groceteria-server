const mongoose = require("mongoose");
const helperModal = require("./helper/helperModal");
const sequencing = require("../utils/counter");

const orderSchema = new mongoose.Schema(
  {
    orderedProducts: [
      {
        name: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        subTotal: { type: Number, required: true },
        productId: {
          type: mongoose.Schema.ObjectId,
          ref: "Product",
          required: true,
        },
      },
    ],
    totalPrice: { type: Number, required: true },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    orderNumber: { type: Number, unique: true },
    paymentMethod: { type: String, enum: ["Stripe", "Paypal"], required: true },
    isPaid: { type: Boolean, default: false },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: Date,
    deliveryFee: { type: Number, default: 0.0, required: true },
    address: helperModal.addressObj,
    notes: { type: String, trim: true },
    status: {
      type: String,
      default: "Order Received",
      enum: [
        "Order Received",
        "Processing",
        "On the way",
        "Delivered",
        "Cancelled",
      ],
    },
  },
  { timestamps: true }
);

// Incrementing orderNumber by 1
orderSchema.pre("save", async function (next) {
  const counter = await sequencing.getSequenceNextValue("orderNumber");
  if (!counter) {
    const newCounter = await sequencing.insertCounter("orderNumber");
    this.orderNumber = newCounter.seq;
    next();
  }
  if (counter) {
    this.orderNumber = counter;
    next();
  }
  // With Promise
  // sequencing
  //   .getSequenceNextValue("orderNumber")
  //   .then((counter) => {
  //     if (!counter) {
  //       sequencing
  //         .insertCounter("orderNumber")
  //         .then((counter) => {
  //           product.orderNumber = counter;
  //           next();
  //         })
  //         .catch((error) => next(error));
  //     } else {
  //       product.orderNumber = counter;
  //       next();
  //     }
  //   })
  //   .catch((error) => next(error));
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
