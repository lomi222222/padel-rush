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

    // الشمس والهلال بنفس أسلوب أيقونات اللعبة. معرّفة هني مو بـwordle-view.js لأن
    // الصفحة الرئيسية تحمّل هالملف وحده
    const SUN =
      '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2' +
      'M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>';
    const MOON = '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>';

    function updateIcon() {
      btn.innerHTML =
        '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        (currentTheme() === "dark" ? SUN : MOON) +
        "</svg>";
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
