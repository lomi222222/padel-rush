// نقل محلي بنفس واجهة net.js لكن بين تبويبات نفس المتصفح (BroadcastChannel +
// localStorage). يُستخدم بالاختبارات وبالتجربة على نفس الجهاز بدون أي إعداد Firebase،
// عبر إضافة ?net=local للرابط.
(function () {
  "use strict";

  const STORE_KEY = "kw-net-local-tree";
  const CHANNEL = "kw-net-local";

  function readTree() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeTree(tree) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(tree));
    } catch (e) {
      /* تجاهل */
    }
  }

  function segments(path) {
    return String(path).split("/").filter(Boolean);
  }

  function getAt(tree, path) {
    let node = tree;
    for (const seg of segments(path)) {
      if (node === null || typeof node !== "object") return null;
      node = node[seg];
      if (node === undefined) return null;
    }
    return node === undefined ? null : node;
  }

  function setAt(tree, path, value) {
    const segs = segments(path);
    if (segs.length === 0) return value;
    let node = tree;
    for (let i = 0; i < segs.length - 1; i++) {
      if (node[segs[i]] === null || typeof node[segs[i]] !== "object") node[segs[i]] = {};
      node = node[segs[i]];
    }
    const last = segs[segs.length - 1];
    if (value === null) delete node[last];
    else node[last] = value;
    return tree;
  }

  function create() {
    const listeners = []; // { path, cb }
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

    function notify(changedPath) {
      const tree = readTree();
      listeners.forEach((l) => {
        // يهمّنا التغيير لو صار داخل المسار المراقَب أو على أحد آبائه
        if (changedPath.startsWith(l.path) || l.path.startsWith(changedPath)) {
          l.cb(getAt(tree, l.path));
        }
      });
    }

    if (channel) {
      channel.addEventListener("message", (e) => {
        if (e.data && e.data.path !== undefined) notify(e.data.path);
      });
    }
    // احتياط لو BroadcastChannel غير متاح: نراقب تغيّر localStorage من التبويبات الثانية
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY) notify("");
    });

    function broadcast(path) {
      notify(path);
      if (channel) channel.postMessage({ path });
    }

    function ref(path) {
      return {
        set(value) {
          const tree = readTree();
          setAt(tree, path, window.Net ? window.Net.sanitize(value) : value);
          writeTree(tree);
          broadcast(path);
          return Promise.resolve();
        },
        update(obj) {
          const tree = readTree();
          const clean = window.Net ? window.Net.sanitize(obj) : obj;
          Object.keys(clean).forEach((key) => {
            setAt(tree, path + "/" + key, clean[key]);
          });
          writeTree(tree);
          broadcast(path);
          return Promise.resolve();
        },
        remove() {
          const tree = readTree();
          setAt(tree, path, null);
          writeTree(tree);
          broadcast(path);
          return Promise.resolve();
        },
        get() {
          return Promise.resolve(getAt(readTree(), path));
        },
        on(cb) {
          const entry = { path: String(path), cb };
          listeners.push(entry);
          cb(getAt(readTree(), path));
          return () => {
            const i = listeners.indexOf(entry);
            if (i !== -1) listeners.splice(i, 1);
          };
        },
        removeOnDisconnect() {
          /* غير مدعوم محلياً */
        },
      };
    }

    function onConnectionChange(cb) {
      cb(true);
      return () => {};
    }

    return { name: "local", ref, onConnectionChange };
  }

  window.NetLocal = { create };
})();
