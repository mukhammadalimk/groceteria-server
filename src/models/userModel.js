const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const validator = require("validator");
const helperModal = require("./helper/helperModal");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "A user must have a name!"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "A user must have a username!"],
      minlength: 5,
      maxlength: 20,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "A user must have an email!"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
      trim: true,
    },
    photo: {
      type: String,
      default: "default.jpg",
    },
    role: {
      type: String,
      enum: ["user", "admin", "manager"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      trim: true,
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      trim: true,
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same",
      },
    },
    // This is how we embed addresses into users
    addresses: [helperModal.addressObj],
    orders: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Order",
      },
    ],
    cardInfo: {
      cardNumber: {
        type: Number,
        minlength: 16,
        maxlength: 16,
        required: [false, "Please provide receiver's credit card number"],
      },
      expirationMonth: { type: Number, required: false, min: 2, max: 2 },
      expirationYear: { type: Number, required: false, min: 4, max: 4 },
      cvcCode: { type: Number, required: false, min: 3, max: 3 },
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
      select: false,
    },
    phoneNumber: { type: Number, max: 15 },
    verificationCode: Number,
    verificationCodeExpires: Date,
    wishlisted: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
      },
    ],
    compare: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
      },
    ],
    passwordChangedAt: Date,
    resetToken: String,
    resetTokenExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypting password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Updating passwordChangedAt property for the user
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Query middleware. Excluding inactive users
// userSchema.pre(/^find/, function (next) {
//   this.find({ status: { $eq: "active" } });
//   next();
// });

// Checking candidate password
userSchema.methods.checkCandidatePassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if user changed password after jwt token was issued
userSchema.methods.changePasswordAfterToken = function (tokenIssuedTime) {
  if (this.passwordChangedAt) {
    const passwordChangedTime = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return tokenIssuedTime < passwordChangedTime;
  }
  return false;
};

// Create a resetToken for reseting user's password
userSchema.methods.createResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.resetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
