const app = require("./app");
const mongoose = require("mongoose");
require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

process.on("warning", (e) => console.warn(e.stack));

const DB = process.env.DB.replace("<PASSWORD>", process.env.DB_PSW);

mongoose.connect(DB).then(() => console.log("DB connection successful!"));
const PORT = process.env.PORT;

const server = app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
