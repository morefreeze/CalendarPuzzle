# Save Slots Design Spec

## Overview

Add a save slot (存档槽位) system to the Calendar Puzzle miniprogram. Each free user can save up to 3 game sessions, with room for future paid users to have more slots.

## Requirements

- Each user can have multiple save slots (free tier: 3 max)
- Auto-save on exit, manual slot switching on entry
- Slots display simple thumbnail + date/difficulty info
- Users can delete slots
- Any puzzle can be saved to any slot (not date-bound)
- Data stored locally with lazy sync to server
- Future-proof for paid tier with more slots

## Data Model

### SaveSlot (shared between client and server)

```typescript
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface SaveSlot {
  id: string;                // UUID
  userId: string;            // WeChat openid
  gameId: string;            // Current puzzle's gameId
  difficulty: Difficulty;    // Difficulty level (union type, matching puzzleGenerator.ts)
  droppedBlocks: PlacedBlock[];    // User-placed blocks (with x/y positions)
  remainingBlocks: BlockType[];    // Blocks still to be placed (no positions until placed)
  prePlacedBlocks: PlacedBlock[];  // Locked blocks pre-placed by difficulty (with positions)
  solvedBoard: string[][];         // Solved board grid of block label characters (for hint system)
  hintedBlocks: string[];          // Block labels that received hints (serialized from Set<string>)
  timerSeconds: number;            // Timer in seconds
  createdAt: number;               // Creation timestamp
  updatedAt: number;               // Last update timestamp
  syncVersion: number;             // Monotonically increasing version for conflict detection
  thumbnailBlocks: PlacedBlock[];  // Block positions for re-rendering thumbnail previews
}
```

### Local Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `calendarPuzzleSlots` | `SaveSlot[]` | All local slots (max 3 for free) |
| `calendarPuzzleActiveSlotId` | `string` | Currently active slot ID |

### Migration from Existing Storage

On first launch after update, migrate existing saved game to a new slot:

1. Read `calendarPuzzleCurrentGameId` to check for existing game
2. If found, read `calendarPuzzleState_{gameId}` and `calendarPuzzleTimer_{gameId}`
3. Create a `SaveSlot` from this data with `difficulty: 'easy'` (default, since old format doesn't track difficulty)
4. Save to `calendarPuzzleSlots` array
5. Set as active slot
6. Delete old keys (`calendarPuzzleState_{gameId}`, `calendarPuzzleTimer_{gameId}`, `calendarPuzzleCurrentGameId`)
7. Set a migration flag `calendarPuzzleSlotsMigrated: true` to avoid re-running

### Server Table: `save_slots`

```sql
CREATE TABLE save_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  dropped_blocks JSON NOT NULL,
  remaining_blocks JSON NOT NULL,
  pre_placed_blocks JSON NOT NULL,
  solved_board JSON NOT NULL,
  hinted_blocks JSON NOT NULL,
  timer_seconds INTEGER DEFAULT 0,
  thumbnail_blocks JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_version INTEGER DEFAULT 1
);
CREATE INDEX idx_save_slots_user ON save_slots(user_id);
```

Note: `thumbnail_blocks` stores block positions for client-side re-rendering, not image data. This avoids base64 storage overhead and works within miniprogram constraints.

## API Design

All endpoints extend the existing Flask backend at `/api`. All endpoints receive `user_id` via `X-User-Id` header. The existing `api.tsx` `request` function supports `GET` and `POST` — no method type changes are needed since all slot endpoints use these two methods.

### GET /api/save-slots

Retrieve all slots for a user.

```
Header: X-User-Id: {openid}
Response: { slots: SaveSlot[], maxSlots: 3 }
```

### POST /api/save-slots/sync

Sync (upsert) a single slot. Implements optimistic concurrency via `syncVersion`.

```
Header: X-User-Id: {openid}
Body: {
  slot: {
    id: string,
    ...all SaveSlot fields,
    syncVersion: number  // client's current version
  }
}

Response (success): {
  slot: SaveSlot,       // server's updated slot (with incremented syncVersion)
  conflict: false
}

Response (conflict): {
  slot: SaveSlot,       // server's version of the slot
  conflict: true
}
```

Server logic:
1. Find existing slot by `id`
2. If not found: insert with `syncVersion = 1`, return success
3. If found and server `syncVersion < request.syncVersion`: update, increment `syncVersion`, return success
4. If found and server `syncVersion >= request.syncVersion`: return conflict with server data
5. Client receives conflict → accept server data, update local, increment local `syncVersion` to match server

### POST /api/save-slots/delete

Delete a slot (using POST to match existing API patterns).

```
Header: X-User-Id: {openid}
Body: { slot_id: string }
Response: { success: boolean }
```

### GET /api/save-slots/quota

Get user's slot quota.

```
Header: X-User-Id: {openid}
Response: { maxSlots: 3, usedSlots: 2, tier: "free" }
```

Future premium users return `{ maxSlots: 10, tier: "premium" }`.

## Sync Strategy

| Event | Local Action | Server Action |
|-------|-------------|---------------|
| App open | Read local cache | Async fetch server slots, merge by `syncVersion` |
| Place/remove block | Save immediately | Debounce: sync after 5s idle (no block activity), then async sync |
| Exit game | Save immediately | Sync immediately |
| Delete slot | Delete immediately | Delete immediately |

### Conflict Resolution

`syncVersion` is only incremented by the server on successful sync. It represents how many times the slot has been synced to the server.

- Client always sends its current `syncVersion`
- Server checks: if client version < server version → conflict (server data wins)
- Client version >= server version → client data is newer, server accepts it
- On conflict, client accepts server data and updates local state

This avoids the "same version, both modified" case entirely because the server is the single source of truth for version numbers.

### Offline Handling

- All operations work locally first
- Failed sync requests queue and retry when network returns
- User sees a subtle sync indicator (e.g., "syncing..." / "saved")

## Frontend Architecture

### New Files

```
src/
├── hooks/
│   ├── useSaveSlots.ts        # Core slot management hook (CRUD, quota check)
│   └── useSlotSync.ts         # Lazy sync logic (debounce, conflict resolution, retry queue)
├── components/
│   ├── SlotList.tsx            # Slot list with thumbnails + delete
│   └── SlotOverwriteDialog.tsx # Confirmation dialog when slots are full
├── utils/
│   └── slotStorage.ts         # Extends existing storage.tsx patterns for slot operations
```

### Modified Files

- `src/utils/storage.tsx` - Add slot-related storage helpers (extend, don't duplicate)
- `src/utils/api.tsx` - Add `DELETE` to method type union, add save-slot API functions
- `src/pages/index/index.tsx` - Integrate slot selection into main page
- `src/components/SimpleBoard.tsx` - Wire slot context, auto-save on state changes

### SimpleBoard Integration

SimpleBoard currently manages its own state via local `useState`. Integration approach:

1. **Props**: Add optional `initialSlot?: SaveSlot` prop to SimpleBoard
2. **Initialization**: If `initialSlot` is provided, hydrate all state from slot data:
   - `droppedBlocks` from `slot.droppedBlocks`
   - `remainingBlocks` from `slot.remainingBlocks`
   - `prePlacedBlocks` from `slot.prePlacedBlocks`
   - `timerSeconds` from `slot.timerSeconds`
   - `hintedBlocks` from `new Set(slot.hintedBlocks)`
   - `puzzle.solvedBoard` from `slot.solvedBoard`
   - Skip difficulty selection screen (difficulty is known from slot)
3. **Auto-save trigger**: On every `droppedBlocks` or `remainingBlocks` change, call `onSlotSave()` callback with current state
4. **New callback prop**: `onSlotSave(state: SlotState)` - parent handles the actual save logic
5. **Exit callback**: `onExitGame()` - parent triggers immediate sync before unmounting
6. **Replace `useGamePersistence`**: The existing hook saves per-gameId to local storage. Slots replace this entirely - `useSaveSlots` handles all persistence

### Continue Game Entry Point

When loading from a slot:
- Parent passes `initialSlot` to SimpleBoard
- SimpleBoard skips the difficulty selection screen (`difficulty` is already set)
- `prePlacedBlocks` are set from slot data instead of being generated
- The `puzzle` object is reconstructed from `solvedBoard` + `remainingBlocks` in the slot

## User Flows

### New Game Flow

1. User selects difficulty
2. Check `usedSlots < maxSlots`
3. If room available: create new slot, enter game
4. If full (3/3): show `SlotOverwriteDialog` displaying 3 slots with thumbnails
5. User picks a slot to overwrite, or cancels
6. Overwritten slot gets new game data, enter game
7. Game progress auto-saves to this slot throughout play

### Continue Game Flow

1. Main page shows "Continue Game" button (visible when slots exist)
2. Tap shows `SlotList` with thumbnails, date, difficulty badge
3. User taps a slot to load its game state
4. User can swipe/long-press to delete a slot
5. If deleting the active slot, clear `calendarPuzzleActiveSlotId`

### Thumbnail Rendering

Instead of generating images (not feasible in miniprogram), store `thumbnailBlocks` — a minimal representation of block positions. The `SlotList` component renders a miniature `BoardPreview`-like inline View using the stored block data. This is lightweight, fast, and works within miniprogram constraints.

## Paid Tier Extension

### Architecture

```typescript
interface SlotQuota {
  maxSlots: number;    // free: 3, premium: 10/20/unlimited
  usedSlots: number;
  tier: 'free' | 'premium';
}
```

### Extension Points

1. **Server**: `GET /api/save-slots/quota` already returns `tier` and `maxSlots`. Add payment verification logic when payment system is integrated.
2. **Frontend**: Show "Upgrade for more slots" entry at bottom of slot list when free user hits limit.
3. **Enforcement**: Check quota before creating new slots. Redirect to upgrade when exceeded.
4. **No changes needed**: Sync, conflict resolution, and deletion logic are tier-independent.

### Current Scope

Only free tier (3 slots) is implemented now. Payment integration and premium tier are placeholder only: the quota API returns tier info and the UI has reserved positions for upgrade prompts, but no actual payment flow.

## Testing Strategy

No test framework is currently configured. Testing will be manual:

- Manual test: new game → save → close miniprogram → reopen → continue → verify all state restored (blocks, timer, difficulty, hints)
- Manual test: 3 slots full → overwrite → verify overwritten slot has new data
- Manual test: offline save → come online → verify data appears on server
- Manual test: migrate from old format → verify existing game appears as slot
- Manual test: delete slot → verify removed from both local and server
- Manual test: conflict (modify on two devices) → verify server version wins
