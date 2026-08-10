# Recorded guitar samples

The pitch-mapped samples in `clean/` and the muted articulation in `muted.mp3` come from
[Karoryfer Samples' Emilyguitar](https://github.com/sfzinstruments/karoryfer.emilyguitar),
played and mapped by D. Smolken and released under CC0 1.0.

Chord Hero uses the medium-forte first round-robin recordings. The selected recordings were
trimmed to three seconds, faded, converted to mono 44.1 kHz MP3 at 96 kbps, and renamed to their
MIDI root pitches. Playback chooses the closest recorded root for each guitar string and makes a
small pitch correction, so chord quality, voicing, capo, and alternate tuning remain accurate.

`manifest.json` defines optional velocity-layered per-voicing recordings. Use the naming pattern
`per-voicing/{voicing-id}/{voice}/{strum|arpeggio}/{soft|hard}/{midi}.wav`; the web player can
fall back to the existing `clean/*.mp3` and `muted.mp3` assets when a layer is absent. Add only
licensed recordings and never store provider credentials in this directory.

Source release:
https://github.com/sfzinstruments/karoryfer.emilyguitar/releases/tag/v1.001

License:
https://creativecommons.org/publicdomain/zero/1.0/
