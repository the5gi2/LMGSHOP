// middleware/auth.js

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/users/login');
    }
};

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.isAdmin) {
        return next();
    } else {
        return res.status(403).send('Access denied. Admins only.');
    }
};

module.exports = {
    isAuthenticated,
    isAdmin
};
