function logoutApp() {
    localStorage.removeItem('username');
    window.location.href = '/logout';
}