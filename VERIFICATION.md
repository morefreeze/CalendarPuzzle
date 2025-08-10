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

After the application is running, you can test the new features and bug fixes.

### 3.1. Coordinate Misalignment Fix

- **Action:** Drag any of the blocks from the bottom panel and drop it onto the calendar grid.
- **Expected Behavior:** The block should be placed on the grid smoothly. The part of the block that you "grabbed" with your cursor should be the part that aligns with the grid cell you drop it on. The placement should not feel offset or misaligned.

### 3.2. Block Rotation and Flip

- **Action:** Before dragging a block, click the "Rotate" and "Flip" buttons that appear below each block in the bottom panel.
- **Expected Behavior:**
    - Clicking "Rotate" should rotate the block's shape 90 degrees clockwise.
    - Clicking "Flip" should flip the block's shape horizontally.
    - You can click the buttons multiple times to see the shape change.
- **Action:** Drag a rotated or flipped block onto the grid.
- **Expected Behavior:** The block should be dropped onto the grid with its new, transformed shape.
