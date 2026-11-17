# Local interface fonts

These font files are kept with the browser client so the game does not need
an internet connection or a third-party font service during a LAN workshop.
Both fonts are distributed under the SIL Open Font License 1.1; the original
license texts are included alongside them.

Vite embeds these fonts in the production `game.css`. This lets the player
client load its typefaces when `index.html` is opened directly from disk,
without local-file font requests or cross-origin preloads. The original font
files and licenses are also copied into the client folder.

| File                       | CSS family      | Use                                                                             | Source                                                                                                             | License                |
| -------------------------- | --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| `ArchivoBlack-Regular.ttf` | `Archivo Black` | Poster headings, weight 400                                                     | [Google Fonts: Archivo Black](https://github.com/google/fonts/blob/main/ofl/archivoblack/ArchivoBlack-Regular.ttf) | `ArchivoBlack-OFL.txt` |
| `DMSans-Variable.ttf`      | `DM Sans`       | Body and controls; normal style, variable weight 100–1000 and optical size 9–40 | [Google Fonts: DM Sans](https://github.com/google/fonts/blob/main/ofl/dmsans/DMSans%5Bopsz%2Cwght%5D.ttf)          | `DMSans-OFL.txt`       |

Downloaded from the official `google/fonts` repository on 2026-11-13. The
DM Sans file is renamed locally from `DMSans[opsz,wght].ttf` for simpler asset
paths; its font contents are unchanged. No fonts are installed on the host.
