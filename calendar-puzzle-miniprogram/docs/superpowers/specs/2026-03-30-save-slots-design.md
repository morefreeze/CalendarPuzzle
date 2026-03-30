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
interface SaveSlot {
  id: string;              // UUID
  userId: string;          // WeChat openid
  gameId: string;          // Current puzzle's gameId
  difficulty: number;      // Difficulty level
  droppedBlocks: Block[];  // Placed blocks
  remainingBlocks: Block[];// Remaining blocks to place
  timerSeconds: number;    // Timer in seconds
  createdAt: number;       // Creation timestamp
  updatedAt: number;       // Last update timestamp
  syncVersion: number;     // Sync version for conflict detection
  thumbnailData: string;   // Thumbnail (base64 or SVG snapshot)
}
```

### Local Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `calendarPuzzleSlots` | `SaveSlot[]` | All local slots (max 3 for free) |
| `calendarPuzzleActiveSlotId` | `string` | Currently active slot ID |

### Server Table: `save_slots`

```sql
CREATE TABLE save_slots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  dropped_blocks JSON NOT NULL,
  remaining_blocks JSON NOT NULL,
  timer_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_version INTEGER DEFAULT 1
);
CREATE INDEX idx_save_slots_user ON save_slots(user_id);
```

## API Design

All endpoints extend the existing Flask backend at `/api`.

### GET /api/save-slots

Retrieve all slots for a user.

```
Query: user_id={openid}
Response: { slots: SaveSlot[], maxSlots: 3 }
```

### POST /api/save-slots/sync

Sync (upsert) a single slot.

```
Body: { slot: SaveSlot }
Response: { slot: SaveSlot, conflict: boolean }
```

Server compares `syncVersion`. If server version is higher, returns `conflict: true` with server data. Client resolves by accepting server version.

### DELETE /api/save-slots/{slot_id}

Delete a slot.

```
Query: user_id={openid}
Response: { success: boolean }
```

### GET /api/save-slots/quota

Get user's slot quota.

```
Query: user_id={openid}
Response: { maxSlots: 3, usedSlots: 2, tier: "free" }
```

Future premium users return `{ maxSlots: 10, tier: "premium" }`.

## Sync Strategy

| Event | Local Action | Server Action |
|-------|-------------|---------------|
| App open | Read local cache | Async fetch server slots, merge by `updatedAt` |
| Place/remove block | Save immediately | Debounce 5s, then async sync |
| Exit game | Save immediately | Sync immediately |
| Delete slot | Delete immediately | Delete immediately |

### Conflict Resolution

- `syncVersion` increments on each save
- Server version > local version: accept server data
- Local version > server version: push to server
- Both modified (same version): accept the one with higher `updatedAt`

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
│   └── slotStorage.ts         # Local storage operations wrapper
```

### Modified Files

- `src/pages/index/index.tsx` - Integrate slot selection into main page
- `src/components/SimpleBoard.tsx` - Auto-save to active slot on state changes

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

### Thumbnail Generation

Use the existing `BoardPreview` component to render an SVG snapshot of the board state. Convert to base64 string for storage. Updated on each auto-save.

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

- Unit tests for `slotStorage.ts` (local CRUD operations)
- Unit tests for sync conflict resolution logic
- Integration tests for API endpoints
- E2E test: new game → save → close → reopen → continue → verify state
- E2E test: 3 slots full → overwrite → verify
- E2E test: offline save → come online → verify sync
