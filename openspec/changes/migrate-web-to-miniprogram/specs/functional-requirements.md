# Functional Requirements

## FR-1: Game Timer

### FR-1.1: Timer Display
- The game must display a timer showing elapsed time in MM:SS format
- Timer must update every second
- Timer must be visible at the top of the game board

### FR-1.2: Timer Persistence
- Timer state must persist across app restarts
- Timer must resume from saved value when app reopens
- Timer must be saved to mini program storage

### FR-1.3: Timer Control
- Timer must start automatically when game initializes
- Timer must stop when game is won
- Timer must reset when "Restart" button is pressed

## FR-2: Game State Management

### FR-2.1: Game ID Generation
- System must generate unique game ID on initialization
- Game ID must be based on current date and board configuration
- Game ID must be fetched from backend API

### FR-2.2: State Persistence
- Dropped blocks must be saved to storage
- Remaining block types must be saved to storage
- State must be restored when app reopens
- State must be cleared when game is restarted

### FR-2.3: Victory Detection
- System must detect when all blocks are placed
- System must verify all placeable cells are covered
- Victory condition must trigger celebration animation
- Victory must stop the timer

## FR-3: Solver Integration

### FR-3.1: Solution Request
- User can request solution via "Get Solution" button
- System must send current board state to backend API
- Request must include dropped blocks and remaining blocks

### FR-3.2: Solution Display
- System must display solution blocks on the board
- Solution must be visually distinct from user-placed blocks
- System must show solving time in seconds

### FR-3.3: Error Handling
- System must display error message if no solution exists
- System must show solving time even for failed attempts
- System must provide suggestions for unsolvable configurations

## FR-4: Drag and Drop

### FR-4.1: Block Selection
- User can select blocks from the panel
- Selected block must follow touch/mouse movement
- Block must be visually highlighted during drag

### FR-4.2: Placement Validation
- System must validate placement in real-time during drag
- Invalid placements must be shown in red
- Valid placements must be shown in block color

### FR-4.3: Block Placement
- User can place block by releasing touch/mouse
- Block must snap to grid on valid placement
- Block must return to panel on invalid placement

### FR-4.4: Block Manipulation
- User can rotate blocks (tap/long-press)
- User can flip blocks (long-press)
- User can return placed blocks to panel (double-tap)

## FR-5: Board Interaction

### FR-5.1: Grid Display
- Board must display 8x7 grid with month/day/weekday labels
- Current month/day/weekday must be highlighted
- Empty cells must be clearly marked

### FR-5.2: Block Panel
- Remaining blocks must be displayed below the board
- Blocks must show label and rotation/flip buttons
- Panel must update when blocks are placed/returned

## FR-6: API Communication

### FR-6.1: Game ID API
- System must call `/api/game-id` endpoint
- Request must include dropped blocks and remaining blocks
- System must handle API failures gracefully

### FR-6.2: Solution API
- System must call `/api/solution` endpoint
- Request must include game ID, dropped blocks, and block types
- System must handle 404 (no solution) and other errors

## FR-7: User Feedback

### FR-7.1: Visual Feedback
- Valid placement must show green/transparent preview
- Invalid placement must show red preview
- Placed blocks must show opacity change

### FR-7.2: Status Messages
- System must show "Solving..." during API request
- System must show error messages with clear text
- System must show victory message with animation

### FR-7.3: Loading States
- "Get Solution" button must show loading state
- Timer must show loading state during initialization
- System must prevent actions during loading
