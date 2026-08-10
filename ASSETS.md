# Asset provenance

This file records the provenance of non-code assets shipped with Glow Thief.

## Runtime visuals and characters

The player, enemies, scenery, particles, UI effects, and other in-game visuals are drawn at runtime by the Canvas code in `app/page.tsx` and styled by `app/globals.css`. The repository contains no third-party sprite sheets, character art, textures, or bundled fonts.

## Audio

Sound effects are synthesized at runtime with the Web Audio API in `app/page.tsx`. The repository contains no music or recorded audio files.

## `public/screenshots/gameplay.png`

- Purpose: README gameplay screenshot.
- Source: captured from this repository's local development build at a 1280×720 browser viewport on 2026-08-10.
- SHA-256: `F90A6C1141C1697ACF685CDDC1C02E6FB95F40389EC0C9172210BEE5A6C27CAE`.
- The screenshot contains only visuals rendered by this project.

## `public/og.png`

- Purpose: social preview image and README illustration.
- Embedded provenance: the PNG contains a C2PA manifest identifying `gpt-image` version `2.0`, the OpenAI Media Service API, and `trainedAlgorithmicMedia` as its digital source type.
- Creation date recorded by the manifest: 2026-07-11.
- SHA-256: `504A3E41463B5B1DFE77B65085AA6E8277A34231179B3D1B777696017ABDDDD7`.
- No third-party reference image or stock-asset attribution is recorded in the repository.

OpenAI's terms assign its rights in generated output to the user to the extent permitted by law, but the person publishing this repository remains responsible for confirming that they generated or are authorized to distribute the image and that any generation inputs were properly licensed. AI-generated works may receive different copyright treatment in different jurisdictions.

To the extent the project owner holds copyright or other transferable rights in `public/og.png`, it is made available under the MIT License included in this repository. No warranty of non-infringement is provided.

## Historical starter assets

Earlier revisions contain the unused Next.js starter SVGs `file.svg`, `globe.svg`, and `window.svg`. They are absent from the current tree and covered by `THIRD_PARTY_NOTICES.md`.
