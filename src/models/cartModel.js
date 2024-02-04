const mongoose = require("mongoose");

// Model might be changed. I need to think whether to send product infor from frontent or first get from backend and send that to cart
const cartModel = new mongoose.Schema({
  cartProducts: [
    {
      name: { type: String, required: true },
      image: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      subTotal: {
        type: Number,
        required: true,
        set: (val) => val.toFixed(2),
      },
      productId: {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
        required: true,
      },
    },
  ],
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  totalPrice: { type: Number, required: true, set: (val) => val.toFixed(2) },
  totalQuantity: { type: Number, required: true },
});

cartModel.index({ user: 1 }, { unique: true });

const Cart = mongoose.model("Cart", cartModel);
module.exports = Cart;
