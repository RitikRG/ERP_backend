import express from 'express';
import * as supplierController from '../controllers/supplier.js';


const router = express.Router();

// R - GET all products
router.get('/', supplierController.getSuppliers);

// C - POST a new Supplier
router.post('/',supplierController.createSupplier);


// R - GET a single product by ID
router.get('/edit/:org_id/:id', supplierController.getSupplierById);

// U - PATCH/PUT to update a product by ID
router.patch('/edit/:org_id/:id', supplierController.updateSupplier);

// D - DELETE a product by ID
router.delete('/delete/:org_id/:id', supplierController.deleteSupplier);

export default router;
