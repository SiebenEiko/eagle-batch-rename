# Contributing

Contributions are welcome if they keep the plugin focused, safe, and compatible with Eagle.

## Guidelines

- Keep the UI English-first while preserving Simplified Chinese and Traditional Chinese localization.
- Do not add analytics, advertising, telemetry, or external network dependencies.
- Preserve the preview-before-save workflow for rename operations.
- Do not modify file extensions unless a future feature explicitly supports that behavior.
- Keep large-library workflows batch-based and responsive.
- Test changes inside Eagle when they touch plugin behavior.

## Development Notes

This plugin is implemented with plain HTML, CSS, and JavaScript for the Eagle Plugin API.

Before publishing, verify:

- `manifest.json` is valid JSON.
- `_locales/en.json`, `_locales/zh_CN.json`, and `_locales/zh_TW.json` are valid UTF-8 JSON.
- `logo.png` exists and matches the manifest path.
- the plugin opens in Eagle and can refresh the current selection.

