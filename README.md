# World-in-Context

Standalone static project website. All required videos, posters, and images are included in `assets/`; no build step or external media directory is required.

Open `index.html`, or preview locally with `python3 -m http.server 8000 --bind 127.0.0.1` and visit `http://127.0.0.1:8000/`.

- `index.html`: cover, ICC overview, video galleries, and BibTeX, with paper links and author details.
- `styles.css`: presentation and responsive layout.
- `app.js`: video playback, independent carousels, and scroll effects.
- `media.js`: public scene IDs, display titles, and exact playlists.
- `assets/`: 24 lightweight background clips, 60 gallery clips, their posters, the logo, and the method figure.

The paper URL, author names, and citation details remain placeholders. The GitHub button links to `HaroldChen19/World-in-Context`.

Media assets use neutral IDs such as `scene-001`. Each scene keeps the same ID across its video and poster; lightweight background versions live in `assets/hero/`, gallery videos in `assets/videos/`, and their covers in `assets/posters/`. Method artwork uses descriptive names such as `assets/figures/method-overview.png`.
