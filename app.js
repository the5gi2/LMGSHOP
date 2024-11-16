// app.js
const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// Routes
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const indexRoutes = require('./routes/index');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Session Middleware
app.use(session({
    secret: 'yourStrongSecretKey', // Replace with a strong secret in production
    resave: false,
    saveUninitialized: false,
}));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Use Routes
app.use('/users', userRoutes);    // API Handling
app.use('/', indexRoutes);        // Handles /login, /home, /product/:id, /cart, etc.
app.use('/admin', adminRoutes);   // Handles /admin/*

// Handle 404 - Not Found
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
