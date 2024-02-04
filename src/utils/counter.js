const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    required: true,
  },
});

const Counter = mongoose.model("Counter", counterSchema);

const getSequenceNextValue = (seqName) => {
  return new Promise((resolve, reject) => {
    Counter.findByIdAndUpdate(
      { _id: seqName },
      { $inc: { seq: 1 } },
      (error, counter) => {
        if (error) {
          reject(error);
        }
        if (counter) {
          resolve(counter.seq + 1);
        } else {
          resolve(null);
        }
      }
    );
  });
};

const insertCounter = async (seqName) => {
  return await Counter.create({ _id: seqName, seq: 1 });
};

module.exports = {
  Counter,
  getSequenceNextValue,
  insertCounter,
};
