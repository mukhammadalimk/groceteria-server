const Cart = require("../../models/cartModel");
const catchAsync = require("../../utils/catchAsync");
const ErrorClass = require("../../utils/errorClass");

// This api is for getting a cart for a particular user
const getMyCart = catchAsync(async (req, res, next) => {
  const userCart = await Cart.findOne({ user: req.user._id });

  return res.status(200).json({
    status: "success",
    results: userCart ? userCart.cartProducts.length : 0,
    data: userCart || {},
  });
});

// This api is used in cartDetail, productDetails and home pages in frontend. (quantity might be above 1)
const addToCart = catchAsync(async (req, res, next) => {
  // Return an error if quantity is negative or zero
  if (req.body.quantity <= 0)
    return next(new ErrorClass("Quantity must be a positive number", 400));

  // 1. Find user cart
  const existingCart = await Cart.findOne({ user: req.user._id });

  // Create a cart if user does not have one
  if (!existingCart) {
    const cartProduct = req.body;
    let updatedProduct = cartProduct;
    updatedProduct.subTotal = cartProduct.quantity * cartProduct.price;

    const userCart = await Cart.create({
      cartProducts: [updatedProduct],
      user: req.user._id,
      totalPrice: cartProduct.subTotal,
      totalQuantity: cartProduct.quantity,
    });

    return res.status(201).json({
      status: "success",
      data: userCart,
    });
  }

  const existingProductIndex = existingCart.cartProducts.findIndex(
    (product) => product.productId == req.body.productId
  );
  const existingProduct = existingCart.cartProducts[existingProductIndex];

  let updatedCart;
  let updatedCartProducts;

  // 2. Product is already added, find the product and update the quantity, subTotal and totalPrice
  if (existingProduct) {
    // Update product quantity and subTotal
    let updatedProduct = existingProduct;
    updatedProduct.quantity = existingProduct.quantity + req.body.quantity;
    updatedProduct.subTotal += req.body.quantity * existingProduct.price;

    // Update cartProducts and cart totalPrice
    updatedCart = existingCart;
    updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts[existingProductIndex] = updatedProduct;
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalPrice += req.body.quantity * updatedProduct.price;
    updatedCart.totalQuantity += req.body.quantity;
  }

  // 3. Cart was created but product is new, add to cart and update totalPrice
  if (!existingProduct) {
    const newProduct = req.body;
    updatedCart = existingCart;
    updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts.push({
      name: newProduct.name,
      price: newProduct.price,
      image: newProduct.image,
      quantity: newProduct.quantity,
      subTotal: newProduct.quantity * newProduct.price,
      productId: newProduct.productId,
    });
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalPrice += newProduct.quantity * newProduct.price;
    updatedCart.totalQuantity += newProduct.quantity;
  }

  const userCart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    updatedCart,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!userCart) return next(new ErrorClass("No cart found with that id", 404));

  return res.status(200).json({
    status: "success",
    data: userCart,
  });
});

// This api is used in shopping cart page in frontend
const updateCart = catchAsync(async (req, res, next) => {
  // Return an error if quantity is negative or zero
  if (req.body.quantity === 0)
    return next(new ErrorClass("Quantity must be either 1 or -1", 400));
  // Increment if quantity is 1
  // Decrement if quantity is -1
  const existingCart = await Cart.findOne({ user: req.user._id });

  if (!existingCart)
    return next(new ErrorClass("No cart found with that id", 404));

  const existingProductIndex = existingCart.cartProducts.findIndex(
    (product) => product.productId == req.body.productId
  );
  const existingProduct = existingCart.cartProducts[existingProductIndex];

  if (!existingProduct) {
    return next(
      new ErrorClass("No product found in the cart with that id", 404)
    );
  }

  let updatedCart;
  // It is for deleting a product from the cart completely
  if (existingProduct.quantity === 1 && req.body.quantity === -1) {
    // Update cartProducts and cart totalPrice
    updatedCart = existingCart;
    let updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts.splice(existingProductIndex, 1);
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalPrice += req.body.quantity * existingProduct.price;
    updatedCart.totalQuantity += req.body.quantity;
  } else {
    // Update product quantity and subTotal
    let updatedProduct = existingProduct;
    updatedProduct.quantity += req.body.quantity;
    updatedProduct.subTotal += req.body.quantity * existingProduct.price;

    // Update cartProducts and cart totalPrice
    updatedCart = existingCart;
    let updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts[existingProductIndex] = updatedProduct;
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalPrice += req.body.quantity * updatedProduct.price;
    updatedCart.totalQuantity += req.body.quantity;
  }

  // It is for deleting cart completely when user removes the last product from the cart
  if (updatedCart.cartProducts.length === 0) {
    await Cart.findOneAndDelete({ user: req.user._id });
    return res.status(204).json({
      status: "success",
      data: null,
    });
  }

  const userCart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    updatedCart,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!userCart) return next(new ErrorClass("No cart found with that id", 404));

  return res.status(200).json({
    status: "success",
    data: userCart,
  });
});

// This api is for deleting one product completely from cart
const deleteProductFromCart = catchAsync(async (req, res, next) => {
  const existingCart = await Cart.findOne({ user: req.user._id });
  // 1. When there is left only one product in the cart, We need to delete that user's cart completely
  if (!existingCart)
    return next(new ErrorClass("No cart found for that user", 400));

  // If productId that is not in the cart comes, return an error
  const deletingProduct = existingCart.cartProducts.find(
    (product) => product.productId.toString() === req.body.productId.toString()
  );
  if (!deletingProduct)
    return next(
      new ErrorClass("No product found with that id in the cart", 400)
    );

  if (existingCart.cartProducts.length === 1) {
    await Cart.deleteOne({ user: req.user._id });
    return res.status(204).json({
      status: "success",
      data: null,
    });
  }

  // 2. When there is more than one product in the cart, we need to delete one product from cart
  let updatedCartProducts = existingCart.cartProducts.filter(
    (product) =>
      product.productId.toString() !== deletingProduct.productId.toString()
  );
  let updatedCart = existingCart;
  updatedCart.cartProducts = updatedCartProducts;
  updatedCart.totalPrice -= deletingProduct.quantity * deletingProduct.price;
  updatedCart.totalQuantity -= deletingProduct.quantity;

  const userCart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    updatedCart,
    {
      new: true,
      runValidators: true,
    }
  );

  return res.status(200).json({
    status: "success",
    data: userCart,
  });
});

module.exports = {
  getMyCart,
  addToCart,
  updateCart,
  deleteProductFromCart,
};
