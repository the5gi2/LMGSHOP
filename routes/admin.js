// routes/admin.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/')); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// Initialize multer with file type and size restrictions
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only JPEG and PNG images are allowed.'));
    }
});

// Paths to data files
const productsFile = path.join(__dirname, '../data/products.json');
const ordersFile = path.join(__dirname, '../data/orders.json');

// Helper functions to read and write data
const readProducts = async () => {
    const exists = await fs.pathExists(productsFile);
    if (!exists) {
        console.warn('products.json does not exist. Creating a new one.');
        await fs.writeJson(productsFile, []);
        return [];
    }

    try {
        const data = await fs.readFile(productsFile, 'utf8');
        const parsedData = JSON.parse(data);
        console.log('Successfully read products.json.');
        return parsedData;
    } catch (err) {
        console.error('Error reading or parsing products.json:', err);
        throw err; // Propagate the error to be handled in the route
    }
};

const writeProducts = async (products) => {
    try {
        await fs.writeFile(productsFile, JSON.stringify(products, null, 2));
        console.log('Successfully wrote to products.json.');
    } catch (err) {
        console.error('Error writing to products.json:', err);
        throw err;
    }
};

const readOrders = async () => {
    try {
        const data = await fs.readFile(ordersFile, 'utf8');
        const parsedData = JSON.parse(data);
        console.log('Successfully read orders.json.');
        return parsedData;
    } catch (err) {
        console.error('Error reading orders.json:', err);
        return [];
    }
};

const writeOrders = async (orders) => {
    try {
        await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2));
        console.log('Successfully wrote to orders.json.');
    } catch (err) {
        console.error('Error writing to orders.json:', err);
    }
};

/* -----------------------------------
   Product Management Routes
------------------------------------ */

// GET Manage Products Page
router.get('/manageProducts', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'manageProducts.html'));
});

// GET Add Product Page
router.get('/addProduct', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'addProduct.html'));
});

// GET Edit Product Page
router.get('/editProduct', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'editProduct.html'));
});

// API to Get All Products
router.get('/api/products', isAuthenticated, isAdmin, async (req, res) => {
    try {
        console.log('Received GET /api/products request.');
        const products = await readProducts();
        console.log(`Sending ${products.length} products to the client.`);
        res.json(products);
    } catch (err) {
        console.error('Error in GET /api/products:', err);
        res.status(500).json({ message: 'Failed to load products.' });
    }
});

// API to Get a Specific Product (for Editing)
router.get('/api/products/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = parseInt(req.params.id);
    console.log(`Received GET /api/products/${productId} request.`);

    try {
        const products = await readProducts();
        const product = products.find(p => p.id === productId);

        if (!product) {
            console.warn(`Product with ID ${productId} not found.`);
            return res.status(404).json({ message: 'Product not found.' });
        }

        console.log(`Sending product with ID ${productId} to the client.`);
        res.json(product);
    } catch (err) {
        console.error(`Error in GET /api/products/${productId}:`, err);
        res.status(500).json({ message: 'Failed to load the product.' });
    }
});

// API to Add a New Product
router.post('/api/products', isAuthenticated, isAdmin, upload.array('images', 10), async (req, res) => {
    const { name, description, options } = req.body;

    console.log('Received Add Product Request:');
    console.log('Name:', name);
    console.log('Description:', description);
    console.log('Options:', options);
    console.log('Number of Images:', req.files.length);

    // Parse options from JSON string
    let parsedOptions;
    try {
        parsedOptions = JSON.parse(options);
    } catch (error) {
        console.error('Invalid options format:', error);
        return res.status(400).json({ message: 'Invalid options format.' });
    }

    // Handle image paths
    const images = req.files.map(file => `/uploads/${file.filename}`);

    // Basic validation: name, description, options, and at least one image
    if (!name || !description || !parsedOptions || !Array.isArray(parsedOptions) || parsedOptions.length === 0 || images.length === 0) {
        console.error('Validation failed: All product fields are required.');
        return res.status(400).json({ message: 'All product fields are required.' });
    }

    // Further validation: ensure each option has a name and price
    for (let opt of parsedOptions) {
        if (!opt.name || isNaN(opt.price)) {
            console.error('Validation failed: Each option must have a valid name and price.');
            return res.status(400).json({ message: 'Each option must have a valid name and price.' });
        }
    }

    try {
        const products = await readProducts();

        // Generate a new unique ID
        const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;

        const newProduct = {
            id: newId,
            name,
            description,
            options: parsedOptions.map(opt => ({
                name: opt.name,
                price: parseFloat(opt.price)
            })),
            images
        };

        products.push(newProduct);
        await writeProducts(products);

        console.log(`Product with ID ${newId} added successfully.`);
        res.status(201).json({ message: 'Product added successfully.', product: newProduct });
    } catch (err) {
        console.error('Error adding new product:', err);
        res.status(500).json({ message: 'Failed to add product.' });
    }
});

// API to Update an Existing Product
router.put('/api/products/:id', isAuthenticated, isAdmin, upload.array('images', 10), async (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, description, options, imageOrder, deleteImages } = req.body;

    console.log(`Received Update Product Request for ID: ${productId}`);
    console.log('Name:', name);
    console.log('Description:', description);
    console.log('Options:', options);
    console.log('Image Order:', imageOrder);
    console.log('Delete Images:', deleteImages);
    console.log('Number of New Images:', req.files.length);

    // Parse options, imageOrder, and deleteImages from JSON strings
    let parsedOptions, parsedImageOrder, parsedDeleteImages;
    try {
        parsedOptions = JSON.parse(options);
        parsedImageOrder = JSON.parse(imageOrder);
        parsedDeleteImages = JSON.parse(deleteImages);
    } catch (error) {
        console.error('Invalid JSON format in options, imageOrder, or deleteImages:', error);
        return res.status(400).json({ message: 'Invalid JSON format in options, imageOrder, or deleteImages.' });
    }

    try {
        const products = await readProducts();
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            console.warn(`Product with ID ${productId} not found.`);
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Update product fields if provided
        if (name) products[productIndex].name = name;
        if (description) products[productIndex].description = description;
        if (parsedOptions && Array.isArray(parsedOptions) && parsedOptions.length > 0) {
            // Validate each option
            for (let opt of parsedOptions) {
                if (!opt.name || isNaN(opt.price)) {
                    console.error('Validation failed: Each option must have a valid name and price.');
                    return res.status(400).json({ message: 'Each option must have a valid name and price.' });
                }
            }
            products[productIndex].options = parsedOptions.map(opt => ({
                name: opt.name,
                price: parseFloat(opt.price)
            }));
        }

        // Handle image deletions
        if (parsedDeleteImages && Array.isArray(parsedDeleteImages) && parsedDeleteImages.length > 0) {
            products[productIndex].images = products[productIndex].images.filter(img => !parsedDeleteImages.includes(img));
            console.log(`Deleted ${parsedDeleteImages.length} images from product ID ${productId}.`);

            // Delete image files from the server
            parsedDeleteImages.forEach(imgPath => {
                const filePath = path.join(__dirname, '../public', imgPath);
                fs.unlink(filePath)
                    .then(() => console.log(`Deleted image file: ${filePath}`))
                    .catch(err => console.error(`Error deleting file ${filePath}:`, err));
            });
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/${file.filename}`);
            products[productIndex].images = products[productIndex].images.concat(newImages);
            console.log(`Added ${newImages.length} new images to product ID ${productId}.`);
        }

        // Reorder images based on imageOrder
        if (parsedImageOrder && Array.isArray(parsedImageOrder)) {
            const reorderedImages = [];
            parsedImageOrder.forEach(idx => {
                if (products[productIndex].images[idx]) {
                    reorderedImages.push(products[productIndex].images[idx]);
                }
            });
            products[productIndex].images = reorderedImages;
            console.log(`Reordered images for product ID ${productId}.`);
        }

        await writeProducts(products);

        console.log(`Product with ID ${productId} updated successfully.`);
        res.json({ message: 'Product updated successfully.', product: products[productIndex] });
    } catch (err) {
        console.error(`Error updating product with ID ${productId}:`, err);
        res.status(500).json({ message: 'Failed to update product.' });
    }
});

// API to Delete a Product
router.delete('/api/products/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = parseInt(req.params.id);
    console.log(`Received Delete Product Request for ID: ${productId}`);

    try {
        const products = await readProducts();
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            console.warn(`Product with ID ${productId} not found.`);
            return res.status(404).json({ message: 'Product not found.' });
        }

        const removedProduct = products.splice(productIndex, 1)[0];
        await writeProducts(products);
        console.log(`Product with ID ${productId} deleted successfully.`);

        // Delete associated image files from the server
        removedProduct.images.forEach(imgPath => {
            const filePath = path.join(__dirname, '../public', imgPath);
            fs.unlink(filePath)
                .then(() => console.log(`Deleted image file: ${filePath}`))
                .catch(err => console.error(`Error deleting file ${filePath}:`, err));
        });

        res.json({ message: 'Product deleted successfully.', product: removedProduct });
    } catch (err) {
        console.error(`Error deleting product with ID ${productId}:`, err);
        res.status(500).json({ message: 'Failed to delete product.' });
    }
});

/* -----------------------------------
   Order Management Routes
------------------------------------ */

// GET Manage Orders Page
router.get('/manageOrders', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'manageOrders.html'));
});

// API to Get All Orders
router.get('/api/orders', isAuthenticated, isAdmin, async (req, res) => {
    try {
        console.log('Received GET /api/orders request.');
        const orders = await readOrders();
        console.log(`Sending ${orders.length} orders to the client.`);
        res.json(orders);
    } catch (err) {
        console.error('Error in GET /api/orders:', err);
        res.status(500).json({ message: 'Failed to load orders.' });
    }
});

// GET Admin Order Detail Page
router.get('/order/:id', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin', 'orderDetail.html'));
});

// API to Get Specific Order
router.get('/api/orders/:id', isAuthenticated, isAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id);
    console.log(`Received GET /api/orders/${orderId} request.`);

    try {
        const orders = await readOrders();
        const order = orders.find(o => o.id === orderId);

        if (!order) {
            console.warn(`Order with ID ${orderId} not found.`);
            return res.status(404).json({ message: 'Order not found.' });
        }

        console.log(`Sending order with ID ${orderId} to the client.`);
        res.json(order);
    } catch (err) {
        console.error(`Error in GET /api/orders/${orderId}:`, err);
        res.status(500).json({ message: 'Failed to load the order.' });
    }
});

// API to Update Order
router.put('/api/orders/:id', isAuthenticated, isAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status, trackingNumber, adminNotes } = req.body;

    console.log(`Received Update Order Request for ID: ${orderId}`);
    console.log('Status:', status);
    console.log('Tracking Number:', trackingNumber);
    console.log('Admin Notes:', adminNotes);

    try {
        const orders = await readOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            console.warn(`Order with ID ${orderId} not found.`);
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Update order fields if provided
        if (status) orders[orderIndex].status = status;
        if (trackingNumber !== undefined) orders[orderIndex].trackingNumber = trackingNumber;
        if (adminNotes !== undefined) orders[orderIndex].adminNotes = adminNotes;

        await writeOrders(orders);

        console.log(`Order with ID ${orderId} updated successfully.`);
        res.json({ message: 'Order updated successfully.', order: orders[orderIndex] });
    } catch (err) {
        console.error(`Error updating order with ID ${orderId}:`, err);
        res.status(500).json({ message: 'Failed to update order.' });
    }
});

// API to Delete an Order (Optional)
router.delete('/api/orders/:id', isAuthenticated, isAdmin, async (req, res) => {
    const orderId = parseInt(req.params.id);
    console.log(`Received Delete Order Request for ID: ${orderId}`);

    try {
        const orders = await readOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            console.warn(`Order with ID ${orderId} not found.`);
            return res.status(404).json({ message: 'Order not found.' });
        }

        const removedOrder = orders.splice(orderIndex, 1)[0];
        await writeOrders(orders);
        console.log(`Order with ID ${orderId} deleted successfully.`);

        res.json({ message: 'Order deleted successfully.', order: removedOrder });
    } catch (err) {
        console.error(`Error deleting order with ID ${orderId}:`, err);
        res.status(500).json({ message: 'Failed to delete order.' });
    }
});

module.exports = router;
