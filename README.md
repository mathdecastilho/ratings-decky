# Ratings Decky

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin that shows review scores from **SteamDB**, **OpenCritic**, and **Metacritic** directly on Steam game pages — without leaving the Steam Deck UI.

## Features

- Displays rating badges for SteamDB, OpenCritic, and Metacritic on each game's page
- Scores are fetched automatically based on the game name resolved from Steam
- Results are cached locally to avoid redundant network requests

## Installation

Install via the [Decky Plugin Store](https://plugins.deckbrew.xyz/) or manually by downloading a release zip and installing through Decky Loader's developer mode.

## Development

### Requirements

- Node.js v16.14+
- pnpm v9 (`npm i -g pnpm@9`)

### Setup

```bash
pnpm install
pnpm build
```

### Testing

```bash
pnpm test
```

## License

BSD-3-Clause
