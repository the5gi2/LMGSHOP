// public/js/navbar.js

document.addEventListener('DOMContentLoaded', async () => {
    const navbar = document.getElementById('navbar');
    try {
        const response = await fetch('/api/currentUser');
        const user = await response.json();

        let navLeft = '<a href="/home">Home</a>';
        let navRight = '';

        if (user) {
            if (user.isAdmin) {
                navLeft += `<a href="/admin/manageProducts">Manage Products</a>`;
            }
            navRight += `<span>Welcome, ${user.username}!</span>`;
            navRight += `<a href="/cart">Cart</a>`;
            navRight += `<a href="/users/logout">Logout</a>`;
        } else {
            navRight += `<a href="/users/login">Login</a>`;
            navRight += `<a href="/users/register">Register</a>`;
        }

        navbar.innerHTML = `
            <div class="nav-left">
                ${navLeft}
            </div>
            <div class="nav-right">
                ${navRight}
            </div>
        `;
    } catch (err) {
        console.error('Error fetching user data:', err);
        navbar.innerHTML = `
            <div class="nav-left">
                <a href="/home">Home</a>
            </div>
            <div class="nav-right">
                <a href="/users/login">Login</a>
                <a href="/users/register">Register</a>
                <a href="/cart">Cart</a>
            </div>
        `;
    }
});
