(function () {
  "use strict";

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem("kw-theme");
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem("kw-theme", theme);
    } catch (e) {
      // تجاهل — بعض المتصفحات تمنع localStorage بالوضع الخاص
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle-btn";
    btn.setAttribute("aria-label", "تبديل الوضع الليلي");

    function updateIcon() {
      btn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
    }

    updateIcon();

    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      setStoredTheme(next);
      updateIcon();
    });

    // بالصفحات اللي فيها topbar (الأذكى، احزر الكلمة)، نحط الزر جنب رابط
    // "القائمة الرئيسية" بدل عائم فوق الصفحة عشان ما يتغطى عليه
    const homeLink = document.querySelector(".topbar .home-link");
    if (homeLink) {
      const actions = document.createElement("div");
      actions.className = "topbar-actions";
      btn.classList.add("theme-toggle-inline");
      homeLink.parentNode.insertBefore(actions, homeLink);
      actions.appendChild(btn);
      actions.appendChild(homeLink);
    } else {
      document.body.appendChild(btn);
    }
  });
})();
