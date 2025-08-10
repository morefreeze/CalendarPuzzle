# Verification Instructions

This document provides instructions on how to set up and run the application to verify the recent changes.

## 1. Setup and Installation

First, you need to install the necessary dependencies for the React application.

```bash
cd my-cal
npm install
```

## 2. Running the Application

Once the dependencies are installed, you can start the development server.

```bash
# still inside the my-cal directory
npm start
```

This will open the application in your default web browser, usually at `http://localhost:3000`.

## 3. Verifying the Changes

The application has been updated with the core gameplay logic for the calendar puzzle.

### 3.1. Board Layout and Date Display

- **Action:** Observe the main grid when the application loads.
- **Expected Behavior:**
    - You should see a new 7x8 grid layout representing a calendar.
    - The cells for the current month, day, and weekday should be highlighted with a distinct color (e.g., khaki). These are the cells that must remain uncovered.

### 3.2. Placing Blocks and Game Rules

- **Action:**
    1.  Drag a block from the bottom panel and move it over the grid.
    2.  Try to place it in a valid, empty position.
    3.  Try to place it so it overlaps with another block you've already placed.
    4.  Try to place it so it covers one of the highlighted date cells.
    5.  Successfully place a block on the board.
- **Expected Behavior:**
    - As you drag the block, a semi-transparent preview should show its potential position.
    - When hovering over an **invalid** position (out-of-bounds, overlapping another block, or covering a date cell), the preview should turn red.
    - You should **not** be able to drop a block in an invalid position.
    - You **should** be able to drop a block in a valid position. **Please test this thoroughly to ensure blocks are placed correctly and stay on the board after the mouse is released.**
    - Once a block is placed on the board, it should disappear from the selection panel at the bottom. You can only use each block shape once.

### 3.3. Block Transformations

- **Action:** Before dragging a block, use the "Rotate" and "Flip" buttons.
- **Expected Behavior:** The block's shape in the bottom panel should change. All the game rules (placement, collision, etc.) should apply correctly to the new, transformed shape.
