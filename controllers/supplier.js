// 1. Import dependencies
import mongoose from 'mongoose';
import Supplier from '../models/supplier.js';
import Organisation from '../models/organisation.js';

// --- C: Create (POST /api/supplier) ------------------------------------------
export const createSupplier = async (req, res, next) => {
    const { org_id, name, company, gst, email, phone } = req.body;

    if (!org_id || !name || !company || !email || !phone) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    // ensuring that org exist
    const existingOrg = await Organisation.findById(org_id);
    if (!existingOrg) {
        return res.status(400).json({ message: 'Organisation not found' });
    }

    const supplier = new Supplier({
        org_id,
        name,
        company,
        gst: gst?gst:'',
        email,
        phone
    });

    try {
        const result = await supplier.save();
        res.status(201).json({
            message: 'Supplier added successfully!',
            product: result
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Creating Supplier failed.', error });
    }
};

// --- R: Read All (GET /api/suppliers) -----------------------------------------
export const getSuppliers = async (req, res, next) => {
    try {
        const org_id = req.query.org_id;
        
        if (!org_id) {
            return res.status(400).json({ message: 'Organisation ID is required.' });
        }
        
        const suppliers = await Supplier.find({org_id}).sort({ name: 1 });
        

        if (!suppliers) {
            return res.status(404).json({ message: 'No Suppliers found.' });
        }

        res.status(200).json({
            message: 'Suppliers fetched successfully!',
            suppliers
        });
    } catch (error) {
        res.status(500).json({ message: 'Fetching suppliers failed.', error });
    }
};

// --- R: Read Single (GET /api/products/:id) ----------------------------------
export const getSupplierById = async (req, res, next) => {
    const supplierId = req.params.id;
    const org_id = req.params.org_id;

    if (!mongoose.Types.ObjectId.isValid(supplierId) || !mongoose.Types.ObjectId.isValid(org_id)) {
        return res.status(400).json({ message: 'Invalid Supplier ID/ Org ID format.' });
    }

    try {
        const supplier = await Supplier.findOne({
            _id: supplierId,
            org_id: org_id,
        });

        if (!supplier) {
            return res.status(404).json({ message: 'Supplier not found.' });
        }

        res.status(200).json({
            message: 'Supplier fetched successfully!',
            supplier: supplier,
        });
    } catch (error) {
        res.status(500).json({ message: 'Fetching supplier failed.', error });
    }
};

// --- U: Update (PATCH /api/products/:id) -------------------------------------
export const updateSupplier = async (req, res, next) => {
  const supplierId = req.params.id;
  const org_id = req.params.org_id;

  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    return res.status(400).json({ message: 'Invalid Supplier ID format.' });
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
    const { name, company, gst, email, phone } = req.body;

    const updateFields = {
      name,
      company,
      gst: gst ? gst : '',
      email: email ? email : '',
      phone: phone ? phone : ''
    };

    const updatedSupplier = await Supplier.findOneAndUpdate(
      { _id: supplierId, org_id },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedSupplier) {
      return res.status(404).json({ message: 'Supplier not found.' });
    }

    res.status(200).json({
      message: 'Supplier updated successfully!',
      supplier: updatedSupplier,
    });
  } catch (error) {
    res.status(500).json({ message: 'Updating supplier failed.', error });
  }
};

// --- D: Delete (DELETE /api/products/:id) ------------------------------------
export const deleteSupplier = async (req, res, next) => {
    const supplierId = req.params.id;
    const org_id = req.params.org_id;

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
        return res.status(400).json({ message: 'Invalid Supplier ID format.' });
    }
    if (!mongoose.Types.ObjectId.isValid(org_id)) {
        return res.status(400).json({ message: 'Invalid Organisation ID format.' });
    }

    try {
        const result = await Supplier.findOneAndDelete({
            _id: supplierId,
            org_id: org_id,
        });

        if (!result) {
            return res.status(404).json({ message: 'Supplier not found or permission not granted' });
        }

        res.status(204).json({ message: 'Supplier deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Deleting supplier failed.', error });
    }
};
