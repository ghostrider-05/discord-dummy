# RL Remote Dummy assets

A test repo for automating dummy package generation and storing it remotely.
Uses the [Asset extractor][assetextractor] to create [dummy assets][rl-dummyassets] for Rocket League

- `/scripts/update.ts`: generate packages and upload remote storage
- `/server/discord.js`: Discord example HTTP-bot that accesses the remote storage
- `/server/worker.js`: Worker that processes the requests

> **Info**
> Run `npm ci && npm run update` after cloning and setting the environment variables

Routes to access the remote dummy assets:

```txt
https://dummy.ghostrider.workers.dev/api?name=<upk_name>
https://dummy.ghostrider.workers.dev/api/metadata
// Current version
https://dummy.ghostrider.workers.dev/api/metadata?key=version
```

[rl-dummyassets]: [https://github.com/Martinii89/RL_DummyAssets]
[assetextractor]: [https://github.com/Martinii89/Unreal-Library]
