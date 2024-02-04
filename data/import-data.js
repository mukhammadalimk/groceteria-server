const mongoose = require("mongoose");
const fs = require("fs");
const dotenv = require("dotenv");
const Food = require("../models/foodModel");

dotenv.config({ path: "./config.env" });

const DB = process.env.DB.replace("<PASSWORD>", process.env.DB_PSW);

mongoose.connect(DB).then(() => console.log("DB connection successful!"));

// READ JSON FILE
const products = JSON.parse(
  fs.readFileSync(`${__dirname}/foods.json`, "utf-8")
);

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    await Food.create(products);
    console.log("Data successfully loaded");
  } catch (error) {
    console.log(error);
  }
  process.exit();
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Food.deleteMany();
    console.log("Data successfully deleted");
  } catch (error) {
    console.log(error);
  }
  process.exit();
};

console.log(process.argv);

if (process.argv[2] === "--import") {
  importData();
} else if (process.argv[2] === "--delete") {
  deleteData();
}
