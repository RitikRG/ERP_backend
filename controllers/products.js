// 1. Import dependencies
import mongoose from 'mongoose';
import Product from '../models/product.js';
import Organisation from '../models/organisation.js';


// --- C: Create (POST /api/products) ------------------------------------------
export const createProduct = async (req, res, next) => {
    const { org_id, name, p_code, cost, price, tax_rate, tax_type } = req.body;

    if (!org_id || !name || !p_code || !cost || !price || !tax_rate || !tax_type) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    // ensuring that org exist
    const existingOrg = await Organisation.findById(org_id);
    if (!existingOrg) {
        return res.status(400).json({ message: 'Organisation not found' });
    }

    // Storing product image
    const imgUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const product = new Product({
        org_id,
        name,
        p_code,
        img: imgUrl,
        cost: Number(cost),
        price: Number(price),
        tax_rate: Number(tax_rate),
        tax_type
    });

    try {
        const result = await product.save();
        res.status(201).json({
            message: 'Product added successfully!',
            product: result
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Product code (p_code) already exists.',
                error
            });
        }
        res.status(500).json({ message: 'Creating product failed.', error });
    }
};

// --- R: Read All (GET /api/products) -----------------------------------------
export const getProducts = async (req, res, next) => {
    try {
        const org_id = req.query.org_id;

        if (!org_id) {
            return res.status(400).json({ message: 'Organisation ID is required.' });
        }

        const products = await Product.find({org_id}).sort({ name: 1 });

        if (!products) {
            return res.status(404).json({ message: 'No products found.' });
        }

        res.status(200).json({
            message: 'Products fetched successfully!',
            products
        });
    } catch (error) {
        res.status(500).json({ message: 'Fetching products failed.', error });
    }
};

// --- R: Read Single (GET /api/products/:id) ----------------------------------
export const getProductById = async (req, res, next) => {
    const productId = req.params.id;
    const org_id = req.params.org_id;

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(org_id)) {
        return res.status(400).json({ message: 'Invalid Product ID/ Org ID format.' });
    }

    try {
        const product = await Product.findOne({
            _id: productId,
            org_id: org_id,
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Get server base URL dynamically
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        const productWithFullImage = {
            ...product.toObject(),
            img: product.img ? `${baseUrl}${product.img}` : null,
        };

        res.status(200).json({
            message: 'Product fetched successfully!',
            product: productWithFullImage,
        });
    } catch (error) {
        res.status(500).json({ message: 'Fetching product failed.', error });
    }
};

// --- U: Update (PATCH /api/products/:id) -------------------------------------
export const updateProduct = async (req, res, next) => {
  const productId = req.params.id;
  const org_id = req.params.org_id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({ message: 'Invalid Product ID format.' });
  }

  if (!mongoose.Types.ObjectId.isValid(org_id)) {
    return res.status(400).json({ message: 'Invalid Org ID format.' });
  }

  try {
    // ensure that org exists
    const existingOrg = await Organisation.findById(org_id);
    if (!existingOrg) {
      return res.status(400).json({ message: 'Organisation not found' });
    }

    // Extract fields from FormData
    const { name, p_code, cost, price, tax_rate, tax_type } = req.body;

    const updateFields = {
      name,
      p_code,
      cost: cost ? Number(cost) : undefined,
      price: price ? Number(price) : undefined,
      tax_rate: tax_rate ? Number(tax_rate) : undefined,
      tax_type,
    };

    // If a new image was uploaded
    if (req.file) {
      updateFields.img = `/uploads/${req.file.filename}`;
    }

    // Remove undefined values
    Object.keys(updateFields).forEach(
      (key) => updateFields[key] === undefined && delete updateFields[key]
    );

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, org_id },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.status(200).json({
      message: 'Product updated successfully!',
      product: updatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Update failed: Product code (p_code) already exists.',
        error,
      });
    }
    res.status(500).json({ message: 'Updating product failed.', error });
  }
};

// --- D: Delete (DELETE /api/products/:id) ------------------------------------
export const deleteProduct = async (req, res, next) => {
    const productId = req.params.id;
    const org_id = req.params.org_id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid Product ID format.' });
    }
    if (!mongoose.Types.ObjectId.isValid(org_id)) {
        return res.status(400).json({ message: 'Invalid Organisation ID format.' });
    }

    try {
        const result = await Product.findOneAndDelete({
            _id: productId,
            org_id: org_id,
        });

        if (!result) {
            return res.status(404).json({ message: 'Product not found or permission not granted' });
        }

        res.status(204).json({ message: 'Product deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Deleting product failed.', error });
    }
};
