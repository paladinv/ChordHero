MIT License

Copyright (c) 2019 Amazon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice (including the next
paragraph) shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Bundled generic hand assets

Source repository: https://github.com/immersive-web/webxr-input-profiles
Source license: https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/LICENSE.md

- `left.glb` — https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/profiles/generic-hand/left.glb
  - 94,572 bytes
  - SHA-256: `bc67783144944ea1cda54d9247885825ea5fb9d4651469fe7d00be517a5c2b87`
- `right.glb` — https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/profiles/generic-hand/right.glb
  - 94,004 bytes
  - SHA-256: `291790c14f7f88a7f9bd35330c47392ed8e8d395ae6728f4bb7089f1bc1f2b96`

## Bundled anatomical hand asset

Source: https://www.innerscene.com/tools/library/3d-parts/posable-anatomical-right-hand-f6098b4f
Download: https://www.innerscene.com/api/library/posable-anatomical-right-hand-f6098b4f/download
License: Public domain (CC0), released by Innerscene from the MakeHuman/MPFB CC0 base.

- `hand-posable.glb` — real-scale right hand, 16 named deforming bones, preserved skin weights
  - 506,476 bytes
  - SHA-256: `d1705ec1317516e79deb5c5ce4ef34e69bf6315bba9025e8a7374fbd0c745f47`

## CC0 bilateral hand/forearm runtime assets

Source: `assets/cc0-hands/Hands + armature.blend` (copied locally with permission)
Source license: `assets/cc0-hands/92895 - LICENSE.html` (CC0 1.0)
Authoring script: `scripts/author-chord-hand-assets.py`

- `cc0-left.glb` and `cc0-right.glb` are generated locally from the source
  rig. They preserve the independently weighted finger bones and add a
  connected low-poly forearm. The source `.blend` is not modified or saved.
