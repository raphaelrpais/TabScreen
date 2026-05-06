(function viewportFullscreenBridge() {
  "use strict";

  if (window.__viewportFullscreenBridgeInstalled) {
    return;
  }
  window.__viewportFullscreenBridgeInstalled = true;

  var CHANNEL = "__viewport_fullscreen__";
  var activeFrame = null;

  window.addEventListener("message", function onMessage(event) {
    if (!event.data || event.data.channel !== CHANNEL) {
      return;
    }

    if (event.data.direction === "control" && event.data.action === "exit") {
      exitFrameViewport({ notifyChild: true });
      return;
    }

    if (event.data.direction !== "request") {
      return;
    }

    var frame = findFrameForWindow(event.source);
    if (!frame) {
      return;
    }

    if (event.data.action === "enter") {
      enterFrameViewport(frame);
      relayToAncestor("enter");
    }

    if (event.data.action === "exit") {
      exitFrameViewport({ notifyChild: false });
      relayToAncestor("exit");
    }
  }, true);

  window.addEventListener("keydown", function onKeyDown(event) {
    if (event.key === "Escape" && activeFrame) {
      exitFrameViewport({ notifyChild: true });
      relayToAncestor("exit");
      event.stopPropagation();
    }
  }, true);

  function enterFrameViewport(frame) {
    if (activeFrame && activeFrame !== frame) {
      exitFrameViewport({ notifyChild: true });
    }

    activeFrame = frame;
    frame.classList.add("vfs-frame-active");
    frame.setAttribute("data-vfs-frame-active", "true");
    lockDocument(true);
  }

  function exitFrameViewport(options) {
    if (!activeFrame) {
      return;
    }

    var previous = activeFrame;
    activeFrame = null;
    previous.classList.remove("vfs-frame-active");
    previous.removeAttribute("data-vfs-frame-active");
    lockDocument(false);

    if (options && options.notifyChild && previous.contentWindow) {
      previous.contentWindow.postMessage({
        channel: CHANNEL,
        direction: "control",
        action: "exit"
      }, "*");
    }
  }

  function relayToAncestor(action) {
    if (window.parent === window) {
      return;
    }

    window.parent.postMessage({
      channel: CHANNEL,
      direction: "request",
      action: action
    }, "*");
  }

  function findFrameForWindow(sourceWindow) {
    if (!sourceWindow || sourceWindow === window) {
      return null;
    }

    var frames = document.querySelectorAll("iframe, frame");

    for (var index = 0; index < frames.length; index += 1) {
      if (frames[index].contentWindow === sourceWindow) {
        return frames[index];
      }
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
})();
