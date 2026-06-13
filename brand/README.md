# DragonsAid brand

Single source of truth for the brand kit. Locked 2026-06-12.

## Files

| File | What |
|---|---|
| `tokens.css` | Color + type tokens (`--da-*`). Import anywhere; never hardcode hexes. |
| `wordmark.html` | Canonical "DRAGON'S AID" wordmark as live text. Copy the `.da-wordmark` block, don't rasterize. |
| `build-icon.py` | Composites a dragon-head PNG onto the brand plate → `icon-source.png` (1024²) for `tauri icon`. |
| `reference/dragon-head-concepts.png` | Original 4-up ChatGPT concept sheet (right column chosen). |
| `reference/*-design-export.html` | Original design-canvas exports the tokens/wordmark were extracted from. |

## Identity in one paragraph

Front-facing armored dragon head (silver plates, gold horns, ember eyes) on a
dark rounded plate — `panel`/`bg` fill, `line` hairline border, ember glow.
Wordmark: Chakra Petch 700 italic, `DRAGON'S` in `--da-text` with apostrophe +
`AID` in ember (0.37em ember glow), over a −20° skewed ember→blue gradient
rule. Temperature contrast (cold steel/blue vs ember) is the brand's core move.

## Type

- **Chakra Petch** — display, wordmark, headings (700 italic for brand moments)
- **Share Tech Mono** — HUD labels, timers (`00:42`)

## Icon pipeline

```sh
python3 brand/build-icon.py <head-art.png> --fill panel
npx tauri icon brand/icon-source.png        # regenerates src-tauri/icons/*
```

Head art must be a transparent-background PNG; the script tight-crops via
alpha, so padding doesn't matter. Plate chosen over transparent mark because
the silver head vanishes on light backgrounds (light-theme taskbar, Store
listing page).
