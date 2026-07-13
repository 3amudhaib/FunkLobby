# opencode context for FunkLobby

## Build & dev commands
- `npm run build` — builds renderer (vite) + main (tsc)
- `npm run dev` — runs in dev mode
- `npm run package` — packages with electron-builder

## Testing
- No test framework set up

## Known conventions
- Main process source: `src/main/`, renderer: `src/renderer/`
- IPC handlers in `src/main/ipc/`
- Prisma ORM for SQLite
