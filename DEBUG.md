# 如何调试

运行 `npm run start`

会在 `build` 目录中生成扩展的源码，

在 Chrome/Edge 浏览器中，通过 `加载已解压的扩展程序` 加载扩展。

然后在浏览器中，打开如下的 URL (id 换成实际的扩展 id)，通过 F12 进行调试

`chrome-extension://idididididididididid/popup.html`
`chrome-extension://idididididididididid/options.html`

[![debug](https://s21.ax1x.com/2025/04/12/pERyRHA.png)](https://imgse.com/i/pERyRHA)

## Performance Testing

### Bundle Size Analysis

To analyze bundle sizes and identify optimization opportunities:

1. **Build the extension**:
   ```bash
   npm run build
   ```

2. **Analyze bundle sizes**:
   - Check the `build/` directory for generated bundles:
     - `options.bundle.js` - Options page bundle
     - `popup.bundle.js` - Popup UI bundle
     - `background.bundle.js` - Background service worker bundle
   - Use Chrome DevTools Sources panel to inspect bundle contents
   - Use webpack-bundle-analyzer (if installed) to visualize bundle composition

3. **Measure load times**:
   - Open Chrome DevTools Performance panel
   - Load the Options page (`chrome-extension://<id>/options.html`)
   - Record performance and check:
     - Time to First Contentful Paint (FCP)
     - Time to Interactive (TTI)
     - JavaScript execution time
     - Network requests and sizes

### Chrome Extension Performance Best Practices

1. **Service Worker Lifecycle**:
   - Background service worker should not keep running unnecessarily
   - Use event-driven architecture (listen to events, don't poll)
   - Cache `chrome.management.getAll()` results (already implemented with 5s TTL)

2. **Bundle Optimization**:
   - Code splitting is implemented for heavy routes (AI, History, Management, Rules)
   - Lazy loading for niche components (react-json-view-lite)
   - Tree-shaking enabled for ESM modules (Ant Design, lodash-es)

3. **Runtime Performance**:
   - Extension operations are batched via `ExecuteTaskHandler`
   - Rules are debounced (20ms) to avoid excessive execution
   - React.memo used for expensive components where appropriate

### Testing Performance Improvements

1. **Before/After Comparison**:
   - Record bundle sizes before and after optimizations
   - Measure load times for Options page and Popup
   - Check background service worker memory usage

2. **Lighthouse Extension Audit** (if available):
   - Use Chrome DevTools Lighthouse extension
   - Run performance audits on Options page
   - Check for opportunities to reduce JavaScript execution time

3. **Manual Testing**:
   - Test all routes load correctly (especially lazy-loaded ones)
   - Verify drag-and-drop still works after DnD library unification
   - Ensure AI features work correctly with cached extension lists
   - Check that extension enable/disable operations remain responsive
