# Calendar Puzzle Mini Program

A WeChat mini program implementation of the classic calendar puzzle game, featuring touch-based drag-and-drop, solver integration, and persistent game state.

## Features

- **Touch-Based Drag-and-Drop**: Intuitive touch interactions for placing blocks
- **Game Timer**: Real-time timer that persists across sessions
- **Solver Integration**: AI-powered solver to help solve puzzles
- **Victory Detection**: Automatic victory detection with celebration
- **State Persistence**: Game state saved to mini program storage
- **Error Handling**: Comprehensive error boundary and error messages

## Tech Stack

- **Framework**: Taro 4.1.5 (React-based)
- **Language**: TypeScript
- **Styling**: SCSS
- **Backend**: Python/Flask (shared with web version)

## Project Structure

```
src/
├── components/
│   ├── CalendarGrid.tsx      # Grid wrapper
│   ├── DraggableBlock.tsx    # Touch-based draggable block
│   ├── GridCell.tsx          # Individual grid cell
│   ├── InitBoard.tsx          # Constants and utilities
│   ├── PlayBoard.tsx          # Main game logic
│   ├── ErrorBoundary.tsx       # Error boundary
│   └── Toast.tsx              # Toast notifications
├── hooks/
│   ├── useGameTimer.tsx       # Timer management
│   ├── useGamePersistence.tsx # Storage management
│   ├── useSolver.tsx           # API integration
│   └── useGameInitialization.tsx # Game initialization
├── utils/
│   ├── logger.tsx             # Logging utilities
│   ├── storage.tsx            # Storage wrapper
│   └── api.tsx                # API client
├── types/
│   └── game.tsx               # TypeScript types
└── pages/
    └── index/
        ├── index.tsx             # Main page
        └── index.scss            # Page styles
```

## Development

### Prerequisites

- Node.js 16+
- npm or yarn
- WeChat Developer Tools
- Taro CLI

### Installation

```bash
cd calendar-puzzle-miniprogram/CalendarPuzzle
npm install
```

### Development

```bash
# Start development server
npm run dev:weapp

# The dist folder will be generated
# Open dist folder in WeChat Developer Tools
```

### Build

```bash
# Build for WeChat mini program
npm run build:weapp
```

## WeChat Developer Tools

1. Download and install [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. Open WeChat Developer Tools
3. Import project: Select `dist` folder
4. Configure AppID (if you have one)
5. Click "Compile" to test in simulator
6. Click "Preview" to test on real device

## API Configuration

The mini program connects to a backend API at `http://localhost:5001/api`. To configure a different API endpoint:

1. Edit `src/utils/api.tsx`
2. Change `API_BASE_URL` to your backend URL

## Game Controls

### Touch Gestures

- **Drag**: Touch and hold a block, then move finger to position
- **Rotate**: Single tap while dragging to rotate 90 degrees clockwise
- **Flip**: Long press (>500ms) while dragging to flip horizontally
- **Return to Panel**: Double tap a placed block to return it to the panel

### Buttons

- **Get Solution**: Request AI solver to solve the puzzle
- **Restart**: Clear all blocks and restart the game

## State Persistence

Game state is automatically saved to mini program storage:
- Dropped blocks positions
- Remaining blocks
- Timer value
- Game ID

State is restored when the app is reopened.

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Taro cache
rm -rf .temp
```

### API Connection Issues

If the mini program cannot connect to the backend:

1. Ensure backend is running: `python server.py`
2. Check API URL in `src/utils/api.tsx`
3. Verify network connectivity
4. Check browser console for error messages

### Touch Events Not Working

If touch events are not responding:

1. Ensure you're using WeChat Developer Tools or real device
2. Check that `onTouchStart`, `onTouchMove`, `onTouchEnd` handlers are properly attached
3. Verify no other elements are blocking touch events

## Testing

### Unit Tests

```bash
# Run tests (if configured)
npm test
```

### Manual Testing Checklist

- [ ] All 10 blocks can be placed on board
- [ ] Timer counts up correctly
- [ ] Timer persists across app restarts
- [ ] Solver API returns and displays solutions
- [ ] Victory condition triggers celebration
- [ ] Touch interactions feel natural
- [ ] No console errors in production build
- [ ] Works on iOS device
- [ ] Works on Android device

## Deployment

### Submit to WeChat

1. Build production version: `npm run build:weapp`
2. Open WeChat Developer Tools
3. Upload mini program
4. Fill in submission details:
   - Mini program name
   - Description
   - Category
   - Screenshot
5. Submit for review
6. Wait for approval
7. Release to public

### Version Management

Update version in `package.json` before each release:

```json
{
  "version": "1.0.0"
}
```

## Performance Optimization

The mini program uses several optimization techniques:

- **Memoization**: Expensive calculations are memoized with `useMemo`
- **Debouncing**: Touch events are debounced to ~60fps
- **Lazy Loading**: Components load only when needed
- **Storage Batching**: Storage writes are batched to reduce I/O

## Accessibility

The mini program includes basic accessibility features:

- High contrast colors
- Clear visual feedback
- Touch targets sized for easy interaction
- Error messages with clear text

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-username/CalendarPuzzle/issues)
- WeChat: [Contact support](mailto:support@example.com)
