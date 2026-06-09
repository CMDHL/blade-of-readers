# Blade of Readers

A tiny browser game prototype for turning a PDF paper into a platformer level.

Upload a PDF and the first page is parsed in the browser:

- text chunks split by spaces and punctuation become thin platforms
- large rendered non-text regions are inferred as image or figure blocks
- the square reader can move, wall-jump, climb screen edges, and use variable-height jumps

## Run Locally

This is a static GitHub Pages-friendly app. Because it uses module scripts and PDF.js from a CDN, run it through a local static server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- `A` / `D` or left / right arrows: move
- `W`, up arrow, or space: jump
- hold jump: jump higher, up to a limit
- hold up while touching a screen edge: climb

## Notes

This first version only reads page 1 of a PDF. The image-block detection is intentionally simple: it looks for large colored/dark clusters after masking out text platforms. The next useful steps are multi-page navigation, tuned collision grouping for diagrams, and proper reader sprites.
