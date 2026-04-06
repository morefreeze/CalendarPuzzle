# Project Context

## Overview

Calendar Puzzle is a modern implementation of the classic calendar puzzle game, featuring an efficient algorithm solver and a user-friendly interface. The project consists of two main parts:
- **Python Backend**: Efficient solver using Dancing Links algorithm
- **React Frontend**: Modern interactive game interface

## Tech Stack

### Backend
- **Python 3.8+**
- **Flask** - Web API framework
- **Dancing Links (DLX)** - Algorithm for exact cover problem solving
- **Docker** - Containerization

### Frontend
- **React 18** + **TypeScript** - Modern component architecture
- **Canvas API** - High-performance graphics rendering
- **CSS Grid** - Responsive layout
- **Web Workers** - Background computation without blocking UI

### WeChat Mini Program
- **Taro** - Cross-platform framework
- **React** - Component development

## Architecture

### Core Components

```
calendar_puzzle/
├── dancing_link/         # DLX algorithm implementation
│   ├── calendar.py       # Game logic
│   └── dl.py             # Dancing Links solver
├── board.py              # Game board logic
├── shape.py              # Shape definitions
└── constants.py          # Game constants
```

### Frontend Structure

```
my-cal/src/
├── components/
│   ├── CalendarGrid.js   # Calendar grid component
│   ├── DraggableBlock.js # Draggable shape component
│   ├── GridCell.js       # Grid cell component
│   ├── InitBoard.js      # Initial board setup
│   └── PlayBoard.js      # Main game board
└── utils/
    └── logger.js         # Logging utilities
```

### API Endpoints

- `GET /api/health` - Health check
- `POST /api/solve` - Solve puzzle
- `GET /api/daily` - Get daily challenge

## Game Rules

### Board Layout
- **Size**: 8 rows × 7 columns grid
- **Special Areas**:
  - Month marker: Top section, marks current month
  - Date marker: Marks current date
  - Weekday marker: Marks current weekday

### Shape Collection
10 unique shapes with different geometric properties:
- U-shape (4 cells) - Symmetric U-type
- V-shape (4 cells) - Right-angle V-type
- I-shape (4 cells) - Linear type
- L-shape (5 cells) - Long L-type
- J-shape (4 cells) - Short J-type
- Q-shape (4 cells) - Square type
- S-shape (4 cells) - Zigzag type
- N-shape (5 cells) - Long N-type
- T-shape (4 cells) - T-type
- Z-shape (4 cells) - Diagonal Z-type

### Victory Conditions
- All 10 shapes must be placed in the grid
- Cannot cover any special markers (month, date, weekday)
- Shapes cannot overlap

## Performance Characteristics

- **Solving Speed**: Average <100ms to find complete solution
- **Memory Usage**: O(n×m) space complexity, n = possible placements, m = constraints
- **Scalability**: Easily extendable to larger puzzle sizes

## Development Workflow

### Local Development
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start backend API
python server.py

# Start React frontend
cd my-cal
npm install
npm start
```

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

### Testing
```bash
# Run Python tests
python -m pytest test_*.py -v

# Run React tests
cd my-cal
npm test
```

## Key Design Decisions

1. **Dancing Links Algorithm**: Chosen for its efficiency in solving exact cover problems, which is the mathematical foundation of the puzzle
2. **Separation of Concerns**: Clear separation between solver logic (Python) and UI (React)
3. **Responsive Design**: Canvas-based rendering for performance across devices
4. **Daily Challenge**: Auto-generated unique puzzles based on current date

## Code Conventions

### Python
- Follow PEP 8 style guide
- Use type hints where appropriate
- Docstrings for all public functions
- Maximum line length: 88 characters

### JavaScript/TypeScript
- ESLint configuration in `.eslintrc`
- Use functional components with hooks
- Prop types or TypeScript interfaces for type safety
- Maximum line length: 100 characters

## Testing Strategy

- **Unit Tests**: Individual shape rotations/mirrors
- **Integration Tests**: Complete solving workflow
- **Performance Tests**: Solving time under different complexity levels
- **Edge Case Tests**: Special dates (leap years, month ends, etc.)

## Deployment

### Development
- Local Flask server
- React dev server
- Hot reload enabled

### Production
- Docker containers
- Nginx reverse proxy
- Environment-based configuration

## Future Enhancements

- AI difficulty adjustment based on user skill level
- Multiplayer real-time battles
- Achievement system with unlockable shapes and skins
- Cross-device progress synchronization
- AR version for enhanced gaming experience
