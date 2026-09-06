# <img src="public/icons/icon_48.png" width="45" align="left"> Yt Negative Filter Es6

DEV INFO
To run:
    npm run watch
then:
    Open chrome://extensions
    Check the Developer mode checkbox
    Click on the Load unpacked extension button
    Select the folder my-extension/build

When you're ready to publish to Chrome Web Store,
    create a minified bundle with
        npm run build 
    and zip it with
        npm run pack.
    Or you can zip the build folder manually.

If you want to add a new file to src/, for the extension to recognize it, configure webpack.config.js

For example, see how "injected.js" was added to this code:

const config = (env, argv) =>
  merge(common, {
    entry: {
      popup: PATHS.src + '/popup.js',
      contentScript: PATHS.src + '/contentScript.js',
      background: PATHS.src + '/background.js',
      injected: PATHS.src + '/injected.js'
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
  });



My Chrome Extension

## Features

- Feature 1
- Feature 2

## Install

[**Chrome** extension]() <!-- TODO: Add chrome extension link inside parenthesis -->

## Contribution

Suggestions and pull requests are welcomed!.

---

This project was bootstrapped with [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)

