const mongoose = require('mongoose');
const { Schema } = mongoose;

const schema = new Schema({
    filename: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

schema.set('toJSON', {
    virtuals: true
});

module.exports = mongoose.model('Picture', schema);