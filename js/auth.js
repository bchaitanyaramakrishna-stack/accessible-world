function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("logged_in_user");
}