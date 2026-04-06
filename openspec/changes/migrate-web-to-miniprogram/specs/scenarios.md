# User Scenarios

## Scenario 1: First-Time User Starts Game

### Pre-conditions
- User opens mini program for the first time
- No saved game state exists

### Steps
1. User opens mini program
2. System initializes game with current date
3. System generates unique game ID from backend
4. Timer starts counting from 00:00
5. Board displays with current month/day/weekday highlighted
6. All 10 blocks shown in panel below board

### Expected Outcomes
- Game ID displayed on screen
- Timer running at 00:00
- All blocks available for placement
- No blocks on board

## Scenario 2: User Places Block on Board

### Pre-conditions
- Game is active
- At least one block available in panel

### Steps
1. User touches and holds a block in panel
2. Block follows finger movement
3. User drags block over board
4. System shows preview (green if valid, red if invalid)
5. User releases finger over valid position
6. Block snaps to grid position
7. Block removed from panel
8. Block added to dropped blocks list

### Expected Outcomes
- Block placed on board at grid position
- Panel no longer shows this block
- Timer continues running
- Game state saved to storage

## Scenario 3: User Rotates Block Before Placement

### Pre-conditions
- Game is active
- Block selected for placement

### Steps
1. User touches and holds a block
2. While holding, user taps screen (short tap)
3. Block rotates 90 degrees clockwise
4. Preview updates with new shape
5. User releases finger to place

### Expected Outcomes
- Block placed in rotated orientation
- Rotation persists if block returned to panel
- Shape update saved to state

## Scenario 4: User Flips Block Before Placement

### Pre-conditions
- Game is active
- Block selected for placement

### Steps
1. User touches and holds a block
2. User holds for >500ms (long press)
3. Block flips horizontally
4. Preview updates with new shape
5. User releases finger to place

### Expected Outcomes
- Block placed in flipped orientation
- Flip persists if block returned to panel
- Shape update saved to state

## Scenario 5: User Returns Block to Panel

### Pre-conditions
- Block is placed on board
- Game is active

### Steps
1. User double-taps a placed block
2. Block removed from board
3. Block returned to panel
4. Panel shows block again

### Expected Outcomes
- Board position becomes empty
- Block available in panel
- Game state updated and saved
- Timer continues running

## Scenario 6: User Requests Solution

### Pre-conditions
- Game is active
- Some blocks may be placed on board
- Backend API is available

### Steps
1. User taps "Get Solution" button
2. Button shows "Solving..." and becomes disabled
3. System sends current board state to backend
4. Backend calculates solution
5. System displays solution blocks on board
6. System shows solving time (e.g., "Solving time: 0.123s")

### Expected Outcomes
- All blocks placed according to solution
- Solution blocks visually distinct
- Timer stops if all blocks placed
- Victory message displayed

## Scenario 7: No Solution Available

### Pre-conditions
- Game is active
- Current board configuration has no solution
- Backend API is available

### Steps
1. User taps "Get Solution" button
2. Button shows "Solving..."
3. System sends request to backend
4. Backend returns 404 (no solution)
5. System displays error message
6. Message includes solving time and suggestion

### Expected Outcomes
- Error message displayed: "Current configuration has no solution! Solving time: 0.456s. Please try adjusting block positions"
- No blocks placed
- Button returns to normal state
- Timer continues running

## Scenario 8: User Wins Game

### Pre-conditions
- All 10 blocks placed on board
- All placeable cells covered

### Steps
1. User places final block
2. System detects victory condition
3. Timer stops
4. Victory message displayed with animation
5. Celebration animation plays

### Expected Outcomes
- "Congratulations, you won!" message displayed
- Timer shows final time
- Game state saved as completed
- No further block placement allowed

## Scenario 9: User Restarts Game

### Pre-conditions
- Game is in progress or completed
- User wants to start over

### Steps
1. User taps "Restart" button
2. System clears all dropped blocks
3. System resets all blocks to panel
4. System resets timer to 00:00
5. System clears saved state
6. Page reloads to restart timer

### Expected Outcomes
- Board empty
- All 10 blocks in panel
- Timer at 00:00
- Fresh game ID generated
- No saved state

## Scenario 10: User Reopens App After Closing

### Pre-conditions
- User had game in progress
- User closed app
- Saved state exists in storage

### Steps
1. User opens mini program
2. System checks for saved state
3. System loads saved dropped blocks
4. System loads saved remaining blocks
5. System loads saved timer value
6. Timer resumes from saved value
7. Board displays saved state

### Expected Outcomes
- Game state exactly as when closed
- Timer continues counting
- All blocks in correct positions
- User can continue playing

## Scenario 11: API Failure During Initialization

### Pre-conditions
- User opens mini program
- Backend API is unavailable

### Steps
1. System attempts to fetch game ID
2. API request fails
3. System catches error
4. System generates fallback game ID locally
5. Game initializes with fallback ID
6. User can still play

### Expected Outcomes
- Game loads successfully
- Fallback game ID displayed
- All features work offline
- Error logged for debugging

## Scenario 12: Invalid Placement Attempt

### Pre-conditions
- Game is active
- User attempts invalid placement

### Steps
1. User drags block over board
2. Preview shows red (invalid)
3. User releases finger
4. Block does not place
5. Block returns to panel

### Expected Outcomes
- Block not placed on board
- Block remains in panel
- No error message needed (visual feedback sufficient)
- Game state unchanged
