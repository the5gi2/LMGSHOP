// routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');

// Path to users.json
const usersFile = path.join(__dirname, '../data/users.json');

// Helper function to read users
const readUsers = async () => {
    try {
        const data = await fs.readFile(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper function to write users
const writeUsers = async (users) => {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
};

// GET Login Page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// GET Register Page
router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'register.html'));
});

// Register Route
router.post('/register', async (req, res) => { // Route: POST /users/register
    const { username, password, password2 } = req.body;

    let errors = [];

    if (!username || !password || !password2) {
        errors.push('Please enter all fields.');
    }

    if (password !== password2) {
        errors.push('Passwords do not match.');
    }

    if (password.length < 6) {
        errors.push('Password must be at least 6 characters.');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    const users = await readUsers();

    const existingUser = users.find(user => user.username === username);
    if (existingUser) {
        errors.push('Username already exists.');
        return res.status(400).json({ errors });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        id: Date.now(),
        username,
        password: hashedPassword,
        isAdmin: false // Default to false; manually set to true in users.json for admin
    };

    users.push(newUser);
    await writeUsers(users);

    return res.status(201).json({ message: 'Registration successful. You can now log in.' });
});

// Login Route
router.post('/login', async (req, res) => { // Route: POST /login
    const { username, password } = req.body;

    let errors = [];

    if (!username || !password) {
        errors.push('Please enter all fields.');
        return res.status(400).json({ errors });
    }

    const users = await readUsers();

    const user = users.find(user => user.username === username);
    if (!user) {
        errors.push('Invalid credentials.');
        return res.status(400).json({ errors });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        errors.push('Invalid credentials.');
        return res.status(400).json({ errors });
    }

    // Set session
    req.session.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
    };

    return res.json({ message: 'Login successful.' });
});

// Logout Route
router.get('/logout', (req, res) => { // Route: GET /users/logout
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Error logging out.' });
        }
        res.redirect('/users/login');
    });
});

module.exports = router;
