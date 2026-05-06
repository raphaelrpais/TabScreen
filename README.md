# TabScreen

Chrome extension that intercepts player fullscreen requests and turns them into a viewport-sized fullscreen inside the browser tab.

The extension icon is generated from `scripts/generate-icons.js` into `assets/icons/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.

## How it works

- Overrides common Fullscreen API entry points from the page context.
- Applies a fixed, black, `100vw` by `100vh` viewport layer instead of native display fullscreen.
- Keeps `document.fullscreenElement` compatible for page scripts while the fake fullscreen is active.
- Bridges iframe players by expanding the iframe in each parent document.
- Press `Esc` to leave the fake fullscreen.

Some browser-native fullscreen controls can briefly enter real fullscreen before the extension converts them back to viewport fullscreen. Cross-origin iframe players are handled by expanding the iframe, but especially locked-down embeds may still vary by site.
