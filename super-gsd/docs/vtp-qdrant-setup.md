# VTP Qdrant — book-figures semantic search

Qdrant is the vector store for VTP's semantic search over book figures (and
later, every other substrate type). It lives on the **SSH build host** —
same box as JCL Mongo, same security posture as the rest of VTP's per-session
bearer tunnel design.

## Architecture

```
┌──────────────────────────────────────┐                  ┌───────────────────────────────────┐
│ Windows laptop                       │                  │ Linux SSH build host              │
│                                      │                  │                                   │
│  Embedding pipeline                  │                  │   Qdrant container                │
│   ├─ bge-base-en-v1.5  → 768-dim     │                  │    ├─ HTTP   127.0.0.1:6333       │
│   ├─ CLIP base-patch32 → 512-dim     │                  │    ├─ gRPC   127.0.0.1:6334       │
│   └─ writes figures.embeddings.jsonl │                  │    └─ Persistent volume           │
│                       │              │                  │                                   │
│  Upsert + query                      │  ssh -L 6333…    │                                   │
│   ──────────────────────────────────────────────────────▶ localhost:6333  (forward tunnel)  │
│                                      │                  │                                   │
│  VTP MCP server                      │                  │                                   │
│   ├─ vtp_search_book_figures tool    │  ssh -R 4101…    │  MCP client on this host          │
│   └─ embeds query → queries Qdrant   │ ◀────────────────  hits localhost:4101 (rev tunnel)  │
└──────────────────────────────────────┘                  └───────────────────────────────────┘
```

Two tunnels in the same SSH session:
- **Reverse** `-R 4101:127.0.0.1:4101` — Linux side talks to laptop's VTP MCP (already built).
- **Forward** `-L 6333:127.0.0.1:6333` — laptop talks to Linux's Qdrant. New.

Both run in the long-lived `autossh` session managed by the
`vtp-mcp-tunnel` Windows service. Per-session bearer auth on the MCP side; the
Qdrant side is loopback-only on Linux + only reachable via this tunnel.

## Linux SSH host — one-time install

1. **Install Docker** if not present:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out and back in for the group to apply
   ```

2. **Run Qdrant** with a persistent volume. The published bind addresses are
   loopback only so nothing outside the SSH session can reach it without going
   through the laptop's tunnel:
   ```bash
   mkdir -p ~/qdrant-data
   docker run -d \
     --name vtp-qdrant \
     --restart unless-stopped \
     -p 127.0.0.1:6333:6333 \
     -p 127.0.0.1:6334:6334 \
     -v ~/qdrant-data:/qdrant/storage \
     qdrant/qdrant:latest
   ```

3. **Verify** Qdrant is up:
   ```bash
   curl -s http://localhost:6333/healthz
   curl -s http://localhost:6333/collections | jq .
   ```

That's all the SSH-host needs. No collection creation by hand — the upsert
script (run from the laptop side) creates `book_figures` with the right
named-vector schema if it doesn't exist.

## Windows laptop — wire the forward tunnel

The existing `vtp-mcp-tunnel` service runs `autossh` with a `-R` reverse port
for MCP. We add a `-L` forward port for Qdrant on the same SSH session — same
process, same authentication, same lifecycle.

Add the forward port to `super-gsd/config/vtp-tunnel.json`:

```json
{
  "remote_host": "jack@your-clarity-build-host.example.com",
  "remote_port": 22,
  "local_mcp_port": 4101,
  "remote_bind_port": 4101,
  "qdrant_forward_port": 6333,
  "ssh_identity": null,
  "extra_ssh_args": []
}
```

The supervisor reads `qdrant_forward_port` and adds
`-L 6333:127.0.0.1:6333` to the ssh args automatically when set. When the
tunnel is up, the laptop can hit `http://localhost:6333` and it goes through
to Qdrant on the SSH host.

Restart the tunnel service:
```powershell
nssm restart vtp-mcp-tunnel
```

## Test from the laptop

After the tunnel is up:
```bash
curl -s http://localhost:6333/healthz
curl -s http://localhost:6333/collections | jq .
```

Should both succeed and the second should show an empty `result.collections`
list (until the upsert runs).

## Operational notes

- **Backup**: Qdrant data lives in `~/qdrant-data` on the SSH host. Snapshot
  it via Qdrant's API: `curl -X POST http://localhost:6333/collections/book_figures/snapshots`.
- **Reset**: `docker rm -f vtp-qdrant && rm -rf ~/qdrant-data && (re-run the docker run)`. Then re-run the upsert script from the laptop.
- **Multiple collections later**: `book_figures` is the first. Adding `meetings`, `research_papers`, `videos` collections later doesn't need infrastructure changes — same Qdrant instance, same tunnel.
- **Auth posture**: Qdrant has no auth on this loopback bind. That's intentional and safe because (a) it only listens on Linux's localhost, (b) the only way the laptop can reach it is via your SSH session, (c) the SSH session uses your key. Anyone on the Linux box who can do `curl localhost:6333` could also do `mongo localhost:27017` — same trust boundary as JCL Mongo.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl localhost:6333` connection refused from laptop | Forward tunnel not in ssh args | Check `qdrant_forward_port` in `vtp-tunnel.json`; restart `vtp-mcp-tunnel` service |
| Qdrant container keeps restarting | Permission on `~/qdrant-data` | `sudo chown -R $USER ~/qdrant-data` |
| Upsert reports "collection exists with wrong vector dim" | Schema drift after an embedding-model change | `curl -X DELETE http://localhost:6333/collections/book_figures` then re-upsert |
| Search returns nothing for an obvious query | Collection empty or wrong | `curl http://localhost:6333/collections/book_figures` to check `points_count` |
