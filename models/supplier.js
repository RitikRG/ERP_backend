import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
    // MongoDB internal fields (_id, __v) are handled automatically by Mongoose
    
    // Reference to the Organization/Shop ID
    org_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        ref: 'Organization' 
    },
    
    // Supplier Name
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    
    // Supplier Company Name
    company: { 
        type: String, 
        required: true,
        trim: true 
    },
    
    // Supplier GST Name
    gst: { 
        type: String, 
        required: false,
        trim: true 
    },

    // Supplier email
    email: { 
        type: String, 
        required: false,
        trim: true 
    },

    // Supplier phone
    phone: { 
        type: String, 
        required: false,
        trim: true 
    }
}, {
    // Mongoose option to automatically add createdAt and updatedAt timestamps
    timestamps: true ,
    collection: 'Suppliers'
});


const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;