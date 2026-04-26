const Comment = require('../models/Comment');
const Product = require('../models/Product');

exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.create({ user: req.user._id, product: req.params.productId, text });
    const product = await Product.findById(req.params.productId);
    product.comments.push(comment._id);
    await product.save();
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
