import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
    // MongoDB internal fields (_id, __v) are handled automatically by Mongoose
    
    // Reference to the Organization/Shop ID
    org_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        // Using 'ref' helps in populating the organization data if needed
        ref: 'Organization' 
    },
    
    // Product Name (e.g., "That night")
    name: { 
        type: String, 
        required: true,
        trim: true // Removes whitespace from both ends of a string
    },
    
    // Product Code (e.g., 12345678)
    p_code: { 
        type: Number, // Using Number for p_code (SKU/Barcode)
        required: true,
        unique: true, // Ensures no two products have the same code
        min: 1 // Assuming product code must be positive
    },
    
    // Image URL or Path
    img: { 
        type: String, 
        default: '' // Defaults to an empty string if no image is provided
    },
    
    // Cost Price (Purchase Price)
    cost: { 
        type: Number, 
        required: true,
        min: 0
    },
    
    // Selling Price
    price: { 
        type: Number, 
        required: true,
        min: 0
    },
    
    // Tax Rate (e.g., 5, 12, 18)
    tax_rate: { 
        type: Number, 
        required: true,
        min: 0,
        max: 100 
    },
    
    // Tax Type ("exclusive" or "inclusive")
    tax_type: { 
        type: String, 
        required: true,
        enum: ['exclusive', 'inclusive'], // Restricts the value to only these two options
        default: 'exclusive'
    },
    
    // Cess (e.g., 0)
    cess: { 
        type: Number, 
        required: true,
        default: 0,
        min: 0
    },

    quantity: { 
        type: Number, 
        required: false,
        default: 0,
    }   
}, {
    // Mongoose option to automatically add createdAt and updatedAt timestamps
    timestamps: true ,
    collection: 'Products'
});


const Product = mongoose.model('Product', productSchema);
export default Product;