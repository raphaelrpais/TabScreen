(function viewportFullscreenHook() {
  "use strict";

  if (window.__viewportFullscreenHookInstalled) {
    return;
  }
  window.__viewportFullscreenHookInstalled = true;

  var CHANNEL = "__viewport_fullscreen__";
  var activeElement = null;
  var convertingNativeFullscreen = false;

  var nativeRequestDescriptors = [
    ["requestFullscreen", Element.prototype],
    ["webkitRequestFullscreen", Element.prototype],
    ["webkitRequestFullScreen", Element.prototype],
    ["mozRequestFullScreen", Element.prototype],
    ["msRequestFullscreen", Element.prototype]
  ];

  var nativeExit = document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.webkitCancelFullScreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;

  var fullscreenElementDescriptor = findDescriptor(Document.prototype, "fullscreenElement");
  var webkitFullscreenElementDescriptor = findDescriptor(Document.prototype, "webkitFullscreenElement");
  var mozFullScreenElementDescriptor = findDescriptor(Document.prototype, "mozFullScreenElement");
  var msFullscreenElementDescriptor = findDescriptor(Document.prototype, "msFullscreenElement");
  var webkitIsFullScreenDescriptor = findDescriptor(Document.prototype, "webkitIsFullScreen");
  var mozFullScreenDescriptor = findDescriptor(Document.prototype, "mozFullScreen");

  patchDocumentFullscreenGetter("fullscreenElement", fullscreenElementDescriptor);
  patchDocumentFullscreenGetter("webkitFullscreenElement", webkitFullscreenElementDescriptor);
  patchDocumentFullscreenGetter("mozFullScreenElement", mozFullScreenElementDescriptor);
  patchDocumentFullscreenGetter("msFullscreenElement", msFullscreenElementDescriptor);
  patchDocumentBooleanGetter("webkitIsFullScreen", webkitIsFullScreenDescriptor);
  patchDocumentBooleanGetter("mozFullScreen", mozFullScreenDescriptor);

  nativeRequestDescriptors.forEach(function patchRequestFullscreen(entry) {
    var method = entry[0];
    var proto = entry[1];
    var descriptor = findDescriptor(proto, method);

    if (!descriptor || typeof descriptor.value !== "function" || descriptor.configurable === false) {
      return;
    }

    Object.defineProperty(proto, method, {
      configurable: true,
      enumerable: descriptor.enumerable,
      writable: true,
      value: function viewportRequestFullscreen() {
        return enterViewportFullscreen(this);
      }
    });
  });

  patchExitFullscreen("exitFullscreen");
  patchExitFullscreen("webkitExitFullscreen");
  patchExitFullscreen("webkitCancelFullScreen");
  patchExitFullscreen("mozCancelFullScreen");
  patchExitFullscreen("msExitFullscreen");

  document.addEventListener("fullscreenchange", convertNativeFullscreen, true);
  document.addEventListener("webkitfullscreenchange", convertNativeFullscreen, true);
  document.addEventListener("mozfullscreenchange", convertNativeFullscreen, true);
  document.addEventListener("MSFullscreenChange", convertNativeFullscreen, true);

  window.addEventListener("keydown", function onKeyDown(event) {
    if (event.key === "Escape" && activeElement) {
      exitViewportFullscreen();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener("message", function onParentControl(event) {
    if (!event.data || event.data.channel !== CHANNEL || event.data.direction !== "control") {
      return;
    }

    if (event.data.action === "exit") {
      exitViewportFullscreen({ silentParent: true });
    }
  });

  function enterViewportFullscreen(element) {
    if (!element || !element.classList) {
      return Promise.resolve();
    }

    if (activeElement && activeElement !== element) {
      exitViewportFullscreen({ silentParent: true });
    }

    activeElement = element;
    element.classList.add("vfs-active");
    element.setAttribute("data-vfs-active", "true");
    lockDocument(true);
    notifyAncestors("enter");
    emitFullscreenChange(element);

    return Promise.resolve();
  }

  function exitViewportFullscreen(options) {
    var previous = activeElement;

    if (!previous) {
      return Promise.resolve();
    }

    activeElement = null;
    previous.classList.remove("vfs-active");
    previous.removeAttribute("data-vfs-active");
    lockDocument(false);

    if (!options || !options.silentParent) {
      notifyAncestors("exit");
    }

    emitFullscreenChange(previous);
    return Promise.resolve();
  }

  function convertNativeFullscreen() {
    if (convertingNativeFullscreen || activeElement) {
      return;
    }

    var nativeElement = getNativeFullscreenElement();
    if (!nativeElement || !nativeExit) {
      return;
    }

    convertingNativeFullscreen = true;

    Promise.resolve()
      .then(function leaveNativeFullscreen() {
        return nativeExit.call(document);
      })
      .catch(function ignoreExitError() {
      })
      .then(function enterFakeFullscreen() {
        return enterViewportFullscreen(nativeElement);
      })
      .finally(function resetNativeConversion() {
        convertingNativeFullscreen = false;
      });
  }

  function getNativeFullscreenElement() {
    return getDescriptorValue(fullscreenElementDescriptor) ||
      getDescriptorValue(webkitFullscreenElementDescriptor) ||
      getDescriptorValue(mozFullScreenElementDescriptor) ||
      getDescriptorValue(msFullscreenElementDescriptor);
  }

  function patchExitFullscreen(method) {
    var descriptor = findDescriptor(Document.prototype, method);

    if (!descriptor || typeof descriptor.value !== "function" || descriptor.configurable === false) {
      return;
    }

    Object.defineProperty(Document.prototype, method, {
      configurable: true,
      enumerable: descriptor.enumerable,
      writable: true,
      value: function viewportExitFullscreen() {
        return exitViewportFullscreen();
      }
    });
  }

  function patchDocumentFullscreenGetter(property, descriptor) {
    if (!descriptor || typeof descriptor.get !== "function" || descriptor.configurable === false) {
      return;
    }

    Object.defineProperty(Document.prototype, property, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function getViewportFullscreenElement() {
        return activeElement || descriptor.get.call(this);
      }
    });
  }

  function patchDocumentBooleanGetter(property, descriptor) {
    if (!descriptor || typeof descriptor.get !== "function" || descriptor.configurable === false) {
      return;
    }

    Object.defineProperty(Document.prototype, property, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: function getViewportFullscreenBoolean() {
        return Boolean(activeElement) || Boolean(descriptor.get.call(this));
      }
    });
  }

  function getDescriptorValue(descriptor) {
    if (!descriptor || typeof descriptor.get !== "function") {
      return null;
    }

    try {
      return descriptor.get.call(document);
    } catch (error) {
      return null;
    }
  }

  function findDescriptor(proto, property) {
    var current = proto;

    while (current) {
      var descriptor = Object.getOwnPropertyDescriptor(current, property);
      if (descriptor) {
        return descriptor;
      }
      current = Object.getPrototypeOf(current);
    }

    return null;
  }

  function lockDocument(locked) {
    var method = locked ? "add" : "remove";
    document.documentElement.classList[method]("vfs-document-locked");

    if (document.body) {
      document.body.classList[method]("vfs-document-locked");
    }
  }

  function notifyAncestors(action) {
    if (window.parent === window) {
      return;
    }

    window.parent.postMessage({
      channel: CHANNEL,
      direction: "request",
      action: action
    }, "*");
  }

  function emitFullscreenChange(target) {
    setTimeout(function dispatchEvents() {
      ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach(function dispatch(name) {
        document.dispatchEvent(new Event(name, { bubbles: true }));

        if (target && typeof target.dispatchEvent === "function") {
          target.dispatchEvent(new Event(name, { bubbles: true }));
        }
      });
    }, 0);
  }
})();
