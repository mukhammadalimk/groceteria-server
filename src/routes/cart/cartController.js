const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const catchAsync = require("../../utils/catchAsync");
const ErrorClass = require("../../utils/errorClass");

// This api is for getting a cart for a particular user
const getMyCart = catchAsync(async (req, res, next) => {
  const userCart = await Cart.findOne({ user: req.user._id });

  return res.status(200).json({
    status: "success",
    results: userCart ? userCart.cartProducts.length : 0,
    data: userCart || null,
  });
});

/// Update cart api
const addToCart = catchAsync(async (req, res, next) => {
  // Return an error if quantity is negative
  if (req.body.quantity <= 0)
    return next(new ErrorClass("Quantity must be above 0.", 400));

  // 1. Find user cart and adding or updating product
  const existingCart = await Cart.findOne({ user: req.user._id });
  const addingProduct = await Product.findById(req.body.productId);

  // Return an error if the product is not found
  if (!addingProduct)
    return next(new ErrorClass("No product found with that id", 404));

  // Create a cart if user does not have one
  if (!existingCart) {
    const addingProductCopy = JSON.parse(JSON.stringify(addingProduct));

    addingProductCopy.price = addingProduct.discountedPrice
      ? addingProduct.discountedPrice
      : addingProduct.price;

    const cartProduct = {
      name: addingProductCopy.name,
      image: addingProductCopy.images[0].imageUrl,
      price: Number(addingProductCopy.price.toFixed(2)),
      quantity: req.body.quantity,
      subTotal: Number(
        (req.body.quantity * addingProductCopy.price).toFixed(2)
      ),
      productId: req.body.productId,
    };

    const userCart = await Cart.create({
      cartProducts: [cartProduct],
      user: req.user._id,
      totalPrice: cartProduct.subTotal,
      totalQuantity: cartProduct.quantity,
    });

    return res.status(201).json({
      status: "success",
      data: userCart,
    });
  }

  // If the user already has a cart
  const existingCartProductIndex = existingCart.cartProducts.findIndex(
    (product) => product.productId == req.body.productId
  );
  const existingCartProduct =
    existingCart.cartProducts[existingCartProductIndex];

  let updatedCart;
  let updatedCartProducts;

  // Product is already added, find the product and update the quantity, subTotal and totalPrice
  if (existingCartProduct) {
    // Update product quantity and subTotal
    let updatedProduct = JSON.parse(JSON.stringify(existingCartProduct));

    updatedProduct.quantity += req.body.quantity;
    const price = addingProduct.discountedPrice || addingProduct.price;
    const subtotal = Number((updatedProduct.quantity * price).toFixed(2));
    updatedProduct.price = Number(price.toFixed(2));
    updatedProduct.subTotal = subtotal;

    // Update cartProducts and cart totalPrice
    updatedCart = existingCart;
    updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts[existingCartProductIndex] = updatedProduct;
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalQuantity += req.body.quantity;
    updatedCart.totalPrice = updatedCart.cartProducts.reduce(
      (sum, item) => sum + item.subTotal,
      0
    );
  }

  // 3. Cart was created but product is new, add to cart and update totalPrice
  if (!existingCartProduct) {
    const price = addingProduct.discountedPrice || addingProduct.price;
    const subtotal = Number((req.body.quantity * price).toFixed(2));

    updatedCart = existingCart;
    updatedCartProducts = existingCart.cartProducts;
    updatedCartProducts.push({
      name: addingProduct.name,
      price: Number(price.toFixed(2)),
      image: addingProduct.images[0].imageUrl,
      quantity: req.body.quantity,
      subTotal: subtotal,
      productId: addingProduct._id,
    });
    updatedCart.cartProducts = updatedCartProducts;
    updatedCart.totalPrice = updatedCart.cartProducts.reduce(
      (sum, item) => sum + item.subTotal,
      0
    );
    updatedCart.totalQuantity += req.body.quantity;
  }

  const userCart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    updatedCart,
    { new: true, runValidators: true }
  );

  if (!userCart) return next(new ErrorClass("No cart found with that id", 404));

  return res.status(200).json({
    status: "success",
    data: userCart,
  });
});

// This api is used in shopping cart page in frontend
const updateCart = catchAsync(async (req, res, next) => {
  // Return an error if quantity is negative
  if (req.body.quantity < 0)
    return next(new ErrorClass("Quantity must be above 1", 400));
  const existingCart = await Cart.findOne({ user: req.user._id });
  const addingProduct = await Product.findById(req.body.productId);

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
  ///// VALIDATION FINISHED

  /// UPDATE LOGIC
  const price = addingProduct.discountedPrice || addingProduct.price;
  const subtotal = Number((req.body.quantity * price).toFixed(2));
  let updatedProduct = JSON.parse(JSON.stringify(existingProduct));
  updatedProduct.quantity = req.body.quantity;
  updatedProduct.price = Number(price.toFixed(2));
  updatedProduct.subTotal = subtotal;

  // Update cartProducts and cart totalPrice
  let updatedCart = existingCart;
  let updatedCartProducts = existingCart.cartProducts;
  updatedCartProducts[existingProductIndex] = updatedProduct;
  updatedCart.cartProducts = updatedCartProducts;
  updatedCart.totalPrice = updatedCart.cartProducts.reduce(
    (sum, item) => sum + item.subTotal,
    0
  );

  updatedCart.totalQuantity =
    updatedCart.totalQuantity - existingProduct.quantity + req.body.quantity;

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

  // If the last product is removed from the cart, the cart will be completely deleted from the database.
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
