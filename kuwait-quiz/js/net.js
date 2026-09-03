// طبقة النقل: واجهة موحّدة (ref/set/update/on) عشان منطق اللعبة الأونلاين ما يعرف
// شي عن Firebase. عندنا تطبيقين بنفس الواجهة: هذا (Firebase Realtime Database)
// و js/net-local.js (BroadcastChannel، للتجربة على نفس الجهاز وللاختبارات).
(function () {
  "use strict";

  // يشيل undefined ويحوّل Set/Map لأشكال يقبلها Firebase
  function sanitize(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  function createFirebaseTransport(config) {
    if (typeof firebase === "undefined" || !firebase.initializeApp) {
      return { error: "sdk-missing" };
    }
    if (!config || !config.databaseURL) {
      return { error: "config-missing" };
    }

    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(config);
      }
    } catch (e) {
      return { error: "init-failed", detail: String(e) };
    }

    const db = firebase.database();

    function ref(path) {
      const r = db.ref(path);
      return {
        set: (value) => r.set(sanitize(value)),
        update: (obj) => r.update(sanitize(obj)),
        remove: () => r.remove(),
        get: () => r.once("value").then((snap) => snap.val()),
        on(cb) {
          const handler = r.on("value", (snap) => cb(snap.val()));
          return () => r.off("value", handler);
        },
        removeOnDisconnect() {
          try {
            r.onDisconnect().remove();
          } catch (e) {
            /* غير مدعوم — نتجاهل */
          }
        },
      };
    }

    function onConnectionChange(cb) {
      const r = db.ref(".info/connected");
      const handler = r.on("value", (snap) => cb(!!snap.val()));
      return () => r.off("value", handler);
    }

    return { name: "firebase", ref, onConnectionChange };
  }

  window.Net = {
    createFirebaseTransport,
    sanitize,
    // ينشئ النقل المناسب: local لو الرابط فيه ?net=local (للتجربة/الاختبار)، وإلا Firebase
    create() {
      const params = new URLSearchParams(location.search);
      if (params.get("net") === "local" && window.NetLocal) {
        return window.NetLocal.create();
      }
      return createFirebaseTransport(window.FIREBASE_CONFIG);
    },
  };
})();
