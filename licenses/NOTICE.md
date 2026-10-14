# Third-party notices

## Material Color Utilities (runtime)

- Package: `@material/material-color-utilities` 0.3.0
- Upstream: https://github.com/material-foundation/material-color-utilities
- Copyright 2021 Google LLC (and upstream contributors as credited in source).
- License: Apache License 2.0, complete text included in `material-color-utilities-APACHE-2.0.txt`.
- Bundled into `content/plugin.js`; retained upstream license headers and legal comments.
- Used for seed-derived MD3 scheme and tonal palettes, without changes to the upstream package.

## Build tooling (not shipped as runtime)

- esbuild 0.25.10: MIT, https://github.com/evanw/esbuild ; complete license in `esbuild-MIT.txt`.
- Node.js built-in test runner and Python standard-library zipfile are used for verification and packaging. No third-party test framework is shipped.

No third-party theme assets, icon fonts, or Zotero source are bundled. Host interfaces were inspected, not copied.

- Prettier 3.6.2: MIT, https://github.com/prettier/prettier ; complete license in `prettier-MIT.txt`. Development-only formatting/checking, not bundled as executable plugin code.
