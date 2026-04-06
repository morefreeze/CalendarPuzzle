# Proposal: Migrate Web Frontend to WeChat Mini Program

## Why We're Doing This

### Current State
The project currently has two frontend implementations:
- **Web version** (`my-cal`): Fully functional with complete game features
- **Mini program version** (`calendar-puzzle-miniprogram`): Basic skeleton with limited functionality

### Problem Statement
The mini program version lacks critical features that make the game playable and engaging:
- No timer functionality
- No solver API integration
- No victory detection
- No game state persistence
- Incomplete drag-and-drop system (react-dnd doesn't work in mini programs)

### Business Value
WeChat mini programs have over 1 billion monthly active users. A fully functional mini program version will:
- Expand user reach to the WeChat ecosystem
- Provide a native mobile experience
- Enable social sharing features
- Support WeChat login and payment integration (future)

## What's Changing

### Scope
Migrate all core game features from `my-cal` to `calendar-puzzle-miniprogram`:

#### Features to Add
1. **Game Timer**
   - Real-time countdown/up timer
   - Persistent timer state across sessions
   - Victory condition stops timer

2. **Solver Integration**
   - Connect to backend API (`/api/solution`)
   - Display solution on the board
   - Show solving time and errors

3. **Game State Management**
   - Save/restore game progress
   - Game ID generation and tracking
   - Victory detection and celebration

4. **Enhanced Drag-and-Drop**
   - Replace react-dnd with mini program native APIs
   - Touch-based block manipulation
   - Visual feedback during drag operations

5. **User Interactions**
   - Block rotation (tap/long-press)
   - Block flipping
   - Double-tap to return blocks to panel
   - Keyboard shortcuts (if supported) or touch alternatives

### What's NOT Changing
- Backend API (Python/Flask) remains unchanged
- Core game logic (Dancing Links algorithm) remains unchanged
- Web version (`my-cal`) continues to be maintained

## Expected Outcomes

### Functional Requirements
- Mini program achieves feature parity with web version
- All game mechanics work correctly on mobile devices
- Smooth touch-based interactions
- Reliable state persistence

### Non-Functional Requirements
- Performance: <100ms response time for drag operations
- Compatibility: Works on iOS and Android WeChat
- Reliability: No data loss when app is closed
- User Experience: Intuitive touch controls

## Success Criteria

1. ✅ All 10 blocks can be placed on the board
2. ✅ Timer counts up/down correctly
3. ✅ Solver API returns and displays solutions
4. ✅ Game state persists across app restarts
5. ✅ Victory condition triggers celebration
6. ✅ Touch interactions feel natural and responsive

## Risks and Mitigations

### Risk 1: Drag-and-Drop Complexity
**Risk**: Mini program drag APIs are less mature than web drag-and-drop
**Mitigation**: Use well-tested touch event handling patterns, test extensively on real devices

### Risk 2: API Compatibility
**Risk**: Mini program network requests differ from web fetch
**Mitigation**: Use `wx.request` with proper error handling and fallback mechanisms

### Risk 3: State Persistence
**Risk**: Mini program storage limits and behavior differ from localStorage
**Mitigation**: Use `wx.setStorageSync` with size monitoring and cleanup strategies

## Timeline Estimate
- **Phase 1** (Core Mechanics): 3-4 days
- **Phase 2** (API Integration): 2-3 days
- **Phase 3** (Polish & Testing): 2-3 days
- **Total**: 7-10 days
