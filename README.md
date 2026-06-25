# Matricule Header Coder Voice

This is a GitHub Pages-ready web version of the matricule header coding app.

## What It Does

- Opens an Excel or CSV file in the browser.
- Finds students by full matricule or short entries like `031`, `C031`, `24C031`, or `UBA24C031`.
- Assigns the current header code and increments automatically.
- Preserves leading zeros such as `001`, `045`, `120`.
- Detects multiple matches, duplicate matricules, year mismatches, and already-coded rows.
- Supports undo.
- Exports an updated file as `OriginalFilename_Coded.xlsx`.
- Adds voice mode for fast hands-free coding.

## Voice Commands

Turn on `Use voice command`, then speak naturally:

- Say digits: `zero three one`, `three one`, or `031`
- Save the current match: `save`
- Clear the search box: `clear`
- Undo the last assignment: `undo`

Recommended fast workflow:

1. Say `zero three one`.
2. Confirm the match shown on screen.
3. Say `save`.
4. Say the next number.

Voice recognition works best in Chrome or Edge. Some browsers do not support the Web Speech API.

## Run Locally

Open `index.html` in Chrome or Edge.

If your browser blocks local file behavior, run a tiny local server from this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload everything inside this folder:

```text
github-voice-version/
```

3. In GitHub, go to `Settings` -> `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save.

GitHub will give you a public URL after the site deploys.

## Can Codex Upload It For You?

I cannot upload it from this environment unless GitHub credentials and network access are available. The folder is ready for you to upload manually, or you can use Git commands on your machine.

## Git Commands

From inside `github-voice-version`:

```powershell
git init
git add .
git commit -m "Add voice matricule header coder"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Then enable GitHub Pages in the repository settings.

## Important Privacy Note

Excel processing happens in the browser. The spreadsheet is not uploaded to a custom server by this app.

Voice recognition is handled by the browser. In Chrome or Edge, speech recognition may use the browser vendor's online speech service depending on browser settings and platform support.

## Dependency

This version uses SheetJS from CDN:

```html
https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
```

That keeps the app simple to upload to GitHub Pages. If you need a fully offline web version, download that file and change the script tag in `index.html` to point to a local copy.
