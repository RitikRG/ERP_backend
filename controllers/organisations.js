// 1. Import dependencies
import mongoose from 'mongoose';
import Organisation from '../models/organisation.js';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import config from '../config/config.js';

// --- C: Create (POST /api/org/register) ------------------------------------------
export const registerOrganisation = async (req, res, next) => {
    try {

        // Getting details from request body
        const { name, gst, address, phone, contact_person_name, email, password } = req.body;

        // Ensuring all the imp details are present
        if (!name || !gst || !address || !phone || !contact_person_name || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        // Checking of the organisation already exists
        const existingOrg = await Organisation.findOne({ gst });
        if (existingOrg) return res.status(400).json({ message: 'Organisation already exists' });

        // Checking if the user already exists
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email already registered with another organisation' });

        // Creating organisation
        const org = new Organisation({
            name,
            gst,
            address,
            phone
        });
        const savedOrg = await org.save();

        // Creating owner user
        const user = new User({ org_id:savedOrg._id, email, password:password, name:contact_person_name, phone, type:"owner" });
        await user.save();

        const accessToken = signAccessToken({ sub: user._id });
        const refreshToken = signRefreshToken({ sub: user._id });
        user.currentRefreshToken = await bcrypt.hash(refreshToken, 10);
        await user.save();

        res.cookie('refreshToken', refreshToken, config.COOKIE_OPTIONS);

        res.status(201).json({
            message: 'Organisation and admin user created successfully!',
            organisation: savedOrg,
            user: { id: user._id, name: user.name, email: user.email },
            accessToken
        });
    } catch (error) {
        res.status(500).json({ message: 'Creating organisation failed.', error });
    }
};


// --- R: Read Single (GET /api/products/:id) ----------------------------------
// export const getProductById = async (req, res, next) => {
//     const productId = req.params.id;

//     if (!mongoose.Types.ObjectId.isValid(productId)) {
//         return res.status(400).json({ message: 'Invalid Product ID format.' });
//     }

//     try {
//         const product = await Product.findById(productId);

//         if (!product) {
//             return res.status(404).json({ message: 'Product not found.' });
//         }

//         res.status(200).json({
//             message: 'Product fetched successfully!',
//             product
//         });
//     } catch (error) {
//         res.status(500).json({ message: 'Fetching product failed.', error });
//     }
// };

// --- U: Update (PATCH /api/products/:id) -------------------------------------


// --- D: Delete (DELETE /api/products/:id) ------------------------------------
