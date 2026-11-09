
// Accessible World - Homepage JavaScript

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(function(link) {

    link.addEventListener("click", function(event) {

        const targetId = this.getAttribute("href");

        if (targetId === "#") {

            event.preventDefault();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

            return;
        }

        const target = document.querySelector(targetId);

        if (target) {

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth"
            });
        }
    });
});

console.log("Accessible World homepage loaded successfully!");
