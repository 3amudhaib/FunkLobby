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

## Engine repo audit (Jul 2026)
Engine config in `src/shared/engineTypes.ts`, asset hints in `src/main/managers/EngineManager.ts` (`BINARY_ASSET_MAP`).

| Engine | Status | Notes |
|---|---|---|
| psych | ✅ Active | ShadowMario/FNF-PsychEngine |
| codename | ✅ Active | CodenameCrew/CodenameEngine |
| cdev | ⚠️ Archived | corecathx/FNF-CDEV-Engine (archived Apr 2025, but releases still downloadable) |
| v-slice | ✅ Active | Psych-Slice/P-Slice |
| fps-plus | ✅ Active | ThatRozebudDude/FPS-Plus-Public |
| micd-up | ✅ Active | Verwex/Funkin-Mic-d-Up-SC |
| yoshicrafter | ⚠️ Dormant | CodenameCrew/YoshiCrafterEngine (last release 2022) |
| dragon | ✅ Active | DibyoExcel/Dragon-Engine |
| shadow | ✅ Active | ShadowEngineTeam/FNF-Shadow-Engine |
| shattered | ⚠️ Minimal | natesway/FNF-Shattered-Engine (only 1 release) |
| slushi | ⚠️ Archived | Slushi-Github/Slushi-Engine (archived Aug 2025; source-only releases) |
| troll | ✅ Active | troll-slaiyers/FNF-Troll-Engine |
| universe | ✅ Fixed | Team-SolarEngine/Solar-Engine-Archive (was Universe Engine, rebranded) |
| vanilla | ✅ Active | FunkinCrew/Funkin |
| funkin-plus-plus | ✅ Active | Psych-Plus-Team/FNF-PlusEngine |

**Fixed in this session:**
- `universe`: repoOwner `Team-UniverseEngine` → `Team-SolarEngine`, repoName `Universe-Engine` → `Solar-Engine-Archive`, display name → "Solar Engine"
- `troll`: repoOwner `riconuts` → `troll-slaiyers` (repo was transferred)
- Updated display names, badges, detection patterns, and website URLs accordingly
- `micd-up`: added repoOwner `Verwex`, repoName `Funkin-Mic-d-Up-SC`, changed from manual→github auto-install
- `forever`: removed from catalog (no releases, user requested deletion)
- `fps-plus` → `micd-up` → `forever`: added `getDownloadUrl()` infrastructure for direct-download auto-install
- `EngineManager.installEngineImpl()`: if `downloadUrl` is set, bypass manual/repo checks and auto-download+install
