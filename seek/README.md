# SEEK introduction and downloads

Public page: https://joyennn.github.io/seek/

The personal website's Tools page links here through `seek/`. The breadcrumb links back through `../tools.html`. These are static HTML, CSS and JavaScript files served by GitHub Pages. No parser server runs on this website.

## Downloads

Installer assets are stored in this repository's GitHub Releases, separately from Pages source. `config.js` specifies the current release, filenames, sizes and SHA-256 hashes. Windows requires the EXE and both BIN files in one folder. Parsing runs on the user's computer; selected language models download on first use. Generating new AI conditions uses the user's own OpenAI API key and billing.

Current release: https://github.com/joyennn/joyennn.github.io/releases/tag/seek-v0.5.0

## Updating

1. Build and validate the desktop installers.
2. Upload a new release and all required installer files, each under 2 GiB, with checksums.
3. Update `config.js` with the actual release URL, version, filenames, sizes and hashes.
4. Verify public links and commit the page update. Do not commit installers or API keys.

The ignored `downloads` path is only for local preview. It must not be committed. The optional `demoVideoUrl` in `config.js` enables a video player; while unset, the page displays “Video coming soon”.
