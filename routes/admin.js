// routes/admin.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Path to products.json
const productsFile = path.join(__dirname, '../data/products.json');

// Helper function to read products
const readProducts = async () => {
    try {
        const data = await fs.readFile(productsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper function to write products
const writeProducts = async (products) => {
    await fs.writeFile(productsFile, JSON.stringify(products, null, 2));
};

// Configure Multer for multiple image uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per image
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// GET Manage Products Page
router.get('/manageProducts', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'manageProducts.html'));
});

// GET Add Product Page
router.get('/addProduct', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'addProduct.html'));
});

// POST Add Product
router.post('/add', isAuthenticated, isAdmin, upload.array('images', 10), async (req, res) => {
    const { name, description, options, imageOrder } = req.body;

    // Basic validation
    if (!name || !description || !options || req.files.length === 0) {
        return res.status(400).json({ errors: ['Please provide all required fields: name, description, options, and at least one image.'] });
    }

    let parsedOptions = [];
    if (options) {
        try {
            parsedOptions = JSON.parse(options);
            // Validate each option has name and price
            parsedOptions = parsedOptions.filter(opt => opt.name && opt.price);
            if (parsedOptions.length === 0) {
                throw new Error();
            }
        } catch (e) {
            return res.status(400).json({ errors: ['Invalid options format.'] });
        }
    }

    // Handle image ordering (received as array of indices)
    let orderedImages = [];
    if (imageOrder) {
        try {
            const imageOrderArray = JSON.parse(imageOrder);
            if (!Array.isArray(imageOrderArray) || imageOrderArray.length !== req.files.length) {
                throw new Error();
            }
            orderedImages = imageOrderArray.map(index => `/uploads/${req.files[index].filename}`);
        } catch (e) {
            return res.status(400).json({ errors: ['Invalid image order format.'] });
        }
    } else {
        // Default order
        orderedImages = req.files.map(file => `/uploads/${file.filename}`);
    }

    const products = await readProducts();
    const newProduct = {
        id: Date.now(),
        name,
        description,
        options: parsedOptions, // Array of { name, price }
        images: orderedImages // Array of image paths
    };
    products.push(newProduct);
    await writeProducts(products);
    return res.status(201).json({ message: 'Product added successfully.' });
});

// GET Edit Product Page
router.get('/editProduct', isAuthenticated, isAdmin, async (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'editProduct.html'));
});

// POST Edit Product
router.post('/edit/:id', isAuthenticated, isAdmin, upload.array('images', 10), async (req, res) => {
    const { name, description, options, imageOrder, deleteImages } = req.body;
    const productId = parseInt(req.params.id);
    const products = await readProducts();
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ errors: ['Product not found.'] });
    }

    // Update fields
    products[productIndex].name = name || products[productIndex].name;
    products[productIndex].description = description || products[productIndex].description;

    // Update options if provided
    if (options) {
        try {
            const parsedOptions = JSON.parse(options);
            products[productIndex].options = parsedOptions.filter(opt => opt.name && opt.price);
        } catch (e) {
            return res.status(400).json({ errors: ['Invalid options format.'] });
        }
    }

    // Handle image deletion
    if (deleteImages) {
        try {
            const imagesToDelete = JSON.parse(deleteImages); // Expecting array of image paths
            if (!Array.isArray(imagesToDelete)) throw new Error();

            for (const imagePath of imagesToDelete) {
                const index = products[productIndex].images.indexOf(imagePath);
                if (index !== -1) {
                    const fullPath = path.join(__dirname, '../public', imagePath);
                    if (await fs.pathExists(fullPath)) {
                        await fs.unlink(fullPath);
                    }
                    products[productIndex].images.splice(index, 1);
                }
            }
        } catch (e) {
            return res.status(400).json({ errors: ['Invalid delete images format.'] });
        }
    }

    // Handle new image uploads and ordering
    if (req.files.length > 0) {
        const newUploadedImages = req.files.map(file => `/uploads/${file.filename}`);
        products[productIndex].images = products[productIndex].images.concat(newUploadedImages);
    }

    // Reorder images if imageOrder is provided
    if (imageOrder) {
        try {
            const imageOrderArray = JSON.parse(imageOrder);
            if (!Array.isArray(imageOrderArray) || imageOrderArray.length !== products[productIndex].images.length) {
                throw new Error();
            }
            // Map the ordered indices to image paths
            const orderedImages = imageOrderArray.map(idx => products[productIndex].images[idx]);
            products[productIndex].images = orderedImages;
        } catch (e) {
            return res.status(400).json({ errors: ['Invalid image order format.'] });
        }
    }

    await writeProducts(products);
    return res.json({ message: 'Product updated successfully.' });
});

// POST Delete Product
router.post('/delete/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = parseInt(req.params.id);
    const products = await readProducts();
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ errors: ['Product not found.'] });
    }

    // Delete image files
    const images = products[productIndex].images;
    for (const image of images) {
        const imagePath = path.join(__dirname, '../public', image);
        if (await fs.pathExists(imagePath)) {
            await fs.unlink(imagePath);
        }
    }

    // Remove product from array
    products.splice(productIndex, 1);
    await writeProducts(products);
    return res.json({ message: 'Product deleted successfully.' });
});

module.exports = router;
