document.addEventListener("DOMContentLoaded", function() {
    if (!localStorage.getItem("cookieConsent")) {
      fetch("/banner.html")
        .then(r => r.text())
        .then(html => {
          const div = document.createElement("div");
          div.innerHTML = html;
          document.body.appendChild(div);
  
          const acceptBtn = document.getElementById("accept-cookies");
          const rejectBtn = document.getElementById("reject-cookies");
  
          if (acceptBtn) {
            acceptBtn.addEventListener("click", () => {
              localStorage.setItem("cookieConsent", "accepted");
              div.remove();
            });
          }
  
          if (rejectBtn) {
            rejectBtn.addEventListener("click", () => {
              localStorage.setItem("cookieConsent", "rejected");
              div.remove();
            });
          }
        });
    }
  });