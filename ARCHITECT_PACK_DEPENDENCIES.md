# Architect Pack Dependencies

## Required NPM Packages

Add to `api/package.json`:

```json
{
  "dependencies": {
    "pdfjs-dist": "^4.0.379",
    "canvas": "^2.11.2",
    "openai": "^4.24.1"
  }
}
```

## Installation Commands

```bash
cd api
pnpm add pdfjs-dist canvas openai
```

## Notes

- **pdfjs-dist**: PDF parsing and rendering
- **canvas**: Server-side Canvas API for Node.js (requires native dependencies)
- **openai**: Official OpenAI API client

### Canvas Installation Issues

If `canvas` fails to install on macOS:

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

If `canvas` fails on Linux:

```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### Alternative: pdf-to-png

If canvas installation is problematic, use `pdf-to-png`:

```bash
pnpm add pdf-to-png
```

And update `pdf-parser.ts` to use it instead.
