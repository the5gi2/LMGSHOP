// routes/index.js
const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');

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

router.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

// Home Page Route (/home)
router.get('/home', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

// Product Detail Page Route (/product/:id)
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

// Cart Page Route (/cart)
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

module.exports = router;
