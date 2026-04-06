# Project Plan: Calendar Puzzle

This document outlines the development plan for the Calendar Puzzle project.

## 1. Project Overview

The project is a web-based implementation of the classic calendar puzzle. It consists of a Python backend that provides a solver for the puzzle, and a React frontend that provides a user interface for interacting with the puzzle. The project also includes a WeChat mini-program version.

## 2. Backend (Python)

The backend is responsible for solving the puzzle and providing an API for the frontend.

### API Endpoints

The backend will expose the following API endpoints:

*   `POST /api/solve`: Solves the puzzle for a given date.
    *   Request body: `{ "month": <int>, "day": <int> }`
    *   Response: `{ "solution": [<array of shape placements>] }`
*   `GET /api/today`: Gets the puzzle for the current date.
    *   Response: `{ "month": <int>, "day": <int> }`
*   `GET /api/health`: Health check endpoint.

### Solver

The solver is implemented using the Dancing Links (DLX) algorithm. The existing implementation in `calendar_puzzle/dancing_link/` will be used.

### Database

No database is required for the initial version of the project.

## 3. Frontend (React)

The frontend provides the user interface for the puzzle.

### Components

The following React components will be created:

*   `CalendarGrid`: Displays the calendar grid.
*   `DraggableBlock`: Represents a puzzle piece that can be dragged and dropped.
*   `GridCell`: Represents a single cell in the calendar grid.
*   `InitBoard`: The initial board setup.
*   `PlayBoard`: The main game board where the user plays.

### State Management

The application state will be managed using React's built-in state management (useState, useReducer) for local component state and React Context for global state where needed.

### UI/UX

The UI will be clean and intuitive. The user will be able to drag and drop the puzzle pieces onto the calendar grid. The application will provide immediate feedback on whether a move is valid.

## 4. Mini Program (Taro)

The mini-program provides the user interface for the puzzle on WeChat.

### Components

The following Taro components will be created:

*   `CalendarGrid`: Displays the calendar grid.
*   `DraggableBlock`: Represents a puzzle piece that can be dragged and dropped.
*   `GridCell`: Represents a single cell in the calendar grid.

### State Management

The application state will be managed using Taro's built-in state management for local component state and a global state management solution like MobX or Redux if needed.

### UI/UX

The UI will be optimized for mobile devices. The user will be able to drag and drop the puzzle pieces onto the calendar grid. The application will provide immediate feedback on whether a move is valid.

## 5. Deployment

The application will be deployed using Docker.

### Docker

The `docker-compose.yml` file will be used to define the services for the backend and frontend. The `Dockerfile.backend` and `my-cal/Dockerfile.frontend` will be used to build the images for the backend and frontend respectively.

### CI/CD

A CI/CD pipeline will be set up using GitHub Actions. The pipeline will:

1.  Run the backend and frontend tests.
2.  Build the Docker images.
3.  Push the images to a container registry.
4.  Deploy the application to a server.

## 6. Testing

### Backend

The backend will be tested using `pytest`. The tests will cover the solver and the API endpoints.

### Frontend

The frontend will be tested using Jest and React Testing Library. The tests will cover the components and the application logic.

## 7. Future Work

*   **AI difficulty adjustment**: The difficulty of the puzzle could be adjusted based on the user's skill level.
*   **Multiplayer mode**: A multiplayer mode could be added where users can compete against each other.
*   **Achievements**: An achievement system could be added to reward users for completing certain tasks.
*   **Cross-device synchronization**: The user's progress could be synchronized across devices.
*   **AR version**: An augmented reality version of the game could be created.
