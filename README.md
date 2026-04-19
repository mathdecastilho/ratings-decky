# Ratings Decky

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin that shows review scores from **SteamDB**, **OpenCritic**, and **Metacritic** directly on Steam game pages — without leaving the Steam Deck UI.

## Screenshots

![Game page with rating badges](assets/screenshot.jpg)

![Store page with rating badges](assets/screenshot_store.jpg)

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

## Legal

The SteamDB rating formula used in this plugin is based on the algorithm described by SteamDB:
https://steamdb.info/blog/steamdb-rating/

The post and formula are dedicated to the public domain. Reference implementations are available
under the MIT license.

This project is not affiliated with or endorsed by SteamDB, Valve, OpenCritic, or Metacritic.
All trademarks and service marks are the property of their respective owners.

## License

BSD-3-Clause
