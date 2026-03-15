import express from 'express';
import * as productsController from '../controllers/products.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// R - GET all products
router.get('/', productsController.getProducts);

// C - POST a new product

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/', upload.single('img'), productsController.createProduct);


// R - GET a single product by ID
router.get('/edit/:org_id/:id', productsController.getProductById);

// U - PATCH/PUT to update a product by ID
router.patch('/edit/:org_id/:id', upload.single('img'), productsController.updateProduct);

// D - DELETE a product by ID
router.delete('/delete/:org_id/:id', productsController.deleteProduct);

export default router;
