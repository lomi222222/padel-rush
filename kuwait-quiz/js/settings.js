// حفظ إعدادات آخر مباراة (عدد الجولات، مدة الجولة، الفئات المختارة) محلياً على
// الجهاز — تُقرأ عند فتح شاشة الإعداد وتُكتب لما المباراة تبدأ فعلياً. يشترك فيه
// الوضعان المحلي والأونلاين (بالأونلاين: الهوست بس هو اللي يقرأ/يكتب).
(function () {
  "use strict";

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null; // وضع خاص أو ممنوع
    }
  }
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* نتجاهل */
    }
  }

  const KEYS = {
    rounds: "kw-settings-rounds",
    timeValue: "kw-settings-time-value",
    timeCustomMinutes: "kw-settings-time-custom-minutes",
    categories: "kw-settings-categories",
  };

  function loadRoundCount(validOptions, fallback) {
    const saved = Number(safeGet(KEYS.rounds));
    return validOptions.includes(saved) ? saved : fallback;
  }
  function saveRoundCount(n) {
    safeSet(KEYS.rounds, String(n));
  }

  // value: نص قيمة <option> المختار. customMinutes: الرقم بالحقل المخصص لو استُخدم
  function loadRoundTime() {
    return { value: safeGet(KEYS.timeValue), customMinutes: safeGet(KEYS.timeCustomMinutes) };
  }
  function saveRoundTime(value, customMinutes) {
    safeSet(KEYS.timeValue, String(value));
    safeSet(KEYS.timeCustomMinutes, customMinutes != null ? String(customMinutes) : "");
  }

  // نتجاهل أي اسم فئة محفوظ ما عاد موجود بالبنك (فئة انحذفت أو تغيّر اسمها)
  function loadCategories(allCategoryNames) {
    const raw = safeGet(KEYS.categories);
    if (!raw) return null;
    try {
      const names = JSON.parse(raw);
      if (!Array.isArray(names)) return null;
      const valid = names.filter((n) => allCategoryNames.includes(n));
      return valid.length ? new Set(valid) : null;
    } catch (e) {
      return null;
    }
  }
  function saveCategories(set) {
    safeSet(KEYS.categories, JSON.stringify([...set]));
  }

  window.WordleSettings = {
    loadRoundCount,
    saveRoundCount,
    loadRoundTime,
    saveRoundTime,
    loadCategories,
    saveCategories,
  };
})();
