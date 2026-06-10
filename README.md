# Blade of Readers

A tiny browser game prototype for turning a PDF paper into a platformer level.

Upload a PDF and its pages are parsed in the browser:

- text chunks split by spaces and punctuation become collision platforms
- the rendered PDF stays visible as-is; collision platforms are invisible and aligned to the text
- the square reader can move, use variable-height jumps, and drop through text platforms
- the browser window acts as the player boundary while scrolling keeps the reader centered when possible
- selected text can be copied, highlighted, commented, and downloaded as standard PDF annotations

## Run Locally

This is a static GitHub Pages-friendly app. Because it uses module scripts plus PDF.js and pdf-lib from CDNs, run it through a local static server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

- `A` / `D` or left / right arrows: move
- space or `Z`: jump
- hold jump: jump higher, up to a limit
- down + jump: pass downward through text platforms until jump is released
- shift or `C`: dash
- `V`: copy selected text
- `H`: highlight selected text
- `J`: comment on selected text
- click an annotation entry: jump to that highlight / comment
- `Delete`: delete the selected annotation entry
- controller left stick: move
- controller `A`: jump
- controller right trigger: dash
- hold controller `LB`, point the right stick at Copy / Highlight / Comment, then release `LB` to confirm
- controller `View`: toggle annotation-list control
- use the controls bar to remap keyboard inputs and controller jump / dash / menu buttons
- attack words to select text; use annotation action keys or the controller radial, then Download Annotated PDF in the top bar
- in annotation-list control, use up / down to select an entry, jump to focus it, and attack to delete it

## Notes

This version renders all PDF pages into one scrollable document. Collision checks are focused around the current page and nearby pages so larger papers stay manageable. The next useful steps are better text-width fidelity, proper reader sprites, and page virtualization for very large PDFs.
