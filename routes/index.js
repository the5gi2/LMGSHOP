// routes/index.js
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');

// Paths to data files
const productsFile = path.join(__dirname, '../data/products.json');
const usersFile = path.join(__dirname, '../data/users.json');
const ordersFile = path.join(__dirname, '../data/orders.json');

// Helper functions to read and write data
const readProducts = async () => {
    try {
        const data = await fs.readFile(productsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const writeProducts = async (products) => {
    await fs.writeFile(productsFile, JSON.stringify(products, null, 2));
};

const readUsers = async () => {
    try {
        const data = await fs.readFile(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const writeUsers = async (users) => {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
};

const readOrders = async () => {
    try {
        const data = await fs.readFile(ordersFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

const writeOrders = async (orders) => {
    await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2));
};

// Existing routes (home, product, cart, etc.)
router.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

router.get('/home', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

router.get('/product/:id', isAuthenticated, async (req, res) => {
    const productId = parseInt(req.params.id);
    const products = await readProducts();
    const product = products.find(p => p.id === productId);

    if (product) {
        res.sendFile(path.join(__dirname, '../public', 'productDetail.html'));
    } else {
        res.status(404).sendFile(path.join(__dirname, '../public', '404.html'));
    }
});

router.get('/cart', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'cart.html'));
});

// API to get all products
router.get('/api/products', isAuthenticated, async (req, res) => {
    const products = await readProducts();
    return res.json(products);
});

// API to get current user
router.get('/api/currentUser', (req, res) => {
    if (req.session.user) {
        res.json({
            username: req.session.user.username,
            isAdmin: req.session.user.isAdmin
        });
    } else {
        res.json(null);
    }
});

// API to get cart items
router.get('/api/cart', isAuthenticated, (req, res) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    res.json(req.session.cart);
});

// API to add item to cart
router.post('/api/cart/add', isAuthenticated, async (req, res) => {
    const { productId, optionIndex } = req.body;
    if (!productId || optionIndex === undefined) {
        return res.status(400).json({ message: 'Invalid product or option.' });
    }

    const products = await readProducts();
    const product = products.find(p => p.id === parseInt(productId));
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }

    if (!product.options || product.options.length === 0) {
        return res.status(400).json({ message: 'No options available for this product.' });
    }

    if (optionIndex < 0 || optionIndex >= product.options.length) {
        return res.status(400).json({ message: 'Invalid option selected.' });
    }

    const selectedOption = product.options[optionIndex];

    const cartItem = {
        productId: product.id,
        name: product.name,
        option: selectedOption.name,
        price: selectedOption.price,
        image: product.images[0] // Assuming first image as thumbnail
    };

    if (!req.session.cart) {
        req.session.cart = [];
    }

    req.session.cart.push(cartItem);

    res.json({ message: 'Product added to cart successfully.', cart: req.session.cart });
});

// API to remove item from cart
router.post('/api/cart/remove', isAuthenticated, (req, res) => {
    const { index } = req.body;
    if (index === undefined || !req.session.cart || index < 0 || index >= req.session.cart.length) {
        return res.status(400).json({ message: 'Invalid cart item index.' });
    }

    req.session.cart.splice(index, 1);
    res.json({ message: 'Item removed from cart successfully.', cart: req.session.cart });
});

/* -----------------------------------
   Checkout and Order Management Routes
------------------------------------ */

// GET Checkout Page
router.get('/checkout', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'checkout.html'));
});

// POST Checkout - Create Order
router.post('/checkout', isAuthenticated, async (req, res) => {
    const { cashappUsername, shippingInfo, userNotes } = req.body;

    // Basic validation
    if (!cashappUsername || !shippingInfo) {
        return res.status(400).json({ message: 'CashApp username and shipping information are required.' });
    }

    if (!req.session.cart || req.session.cart.length === 0) {
        return res.status(400).json({ message: 'Your cart is empty.' });
    }

    const users = await readUsers();
    const user = users.find(u => u.id === req.session.user.id);

    if (!user) {
        return res.status(400).json({ message: 'User not found.' });
    }

    const orders = await readOrders();

    const newOrder = {
        id: Date.now(),
        userId: user.id,
        username: user.username,
        items: req.session.cart,
        cashappUsername,
        shippingInfo: {
            address: shippingInfo.address,
            city: shippingInfo.city,
            state: shippingInfo.state,
            zip: shippingInfo.zip,
            country: shippingInfo.country
        },
        userNotes: userNotes || '',
        status: 'Pending',
        trackingNumber: '',
        adminNotes: '',
        createdAt: new Date().toISOString()
    };

    orders.unshift(newOrder);
    await writeOrders(orders);

    // Clear the cart
    req.session.cart = [];

    return res.status(201).json({ message: 'Checkout successful.', orderId: newOrder.id });
});

// GET User's Orders Page
router.get('/orders', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'orders.html'));
});

// API to Get User's Orders
router.get('/api/orders', isAuthenticated, async (req, res) => {
    const orders = await readOrders();
    const userOrders = orders.filter(order => order.userId === req.session.user.id);
    return res.json(userOrders);
});

// GET User's Order Detail Page
router.get('/order/:id', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'orderDetail.html'));
});

// API to Get Specific User's Order
router.get('/api/orders/:id', isAuthenticated, async (req, res) => {
    const orderId = parseInt(req.params.id);
    const orders = await readOrders();
    const order = orders.find(o => o.id === orderId && o.userId === req.session.user.id);

    if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
    }

    return res.json(order);
});

module.exports = router;
