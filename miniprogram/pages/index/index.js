// index.js
Page({
  data: {
    boardLayoutData: [],
    blockTypes: [],
    droppedBlocks: [],
    CELL_SIZE: 70, // in px
    CELL_BOARDER: 1, // in px
    GAP_SIZE: 0, // in px
    gridInfo: {},
    draggingBlock: {
      isDragging: false,
      block: null,
      x: 0,
      y: 0,
      offsetX: 0,
      offsetY: 0
    },
    previewBlock: {
      shape: [],
      x: 0,
      y: 0,
      isValid: false,
      isVisible: false
    }
  },

  onLoad() {
    this.initializeBoard();
    this.initializeBlocks();
    const query = wx.createSelectorQuery().in(this);
    query.select('.grid-container').boundingClientRect(res => {
      if (res) {
        this.setData({ gridInfo: res });
      }
    }).exec()
  },

  initializeBlocks() {
    this.setData({
      blockTypes: [
        { id: 'I-block', label: 'I', color: '#00FFFF', shape: [[1, 1, 1, 1]] },
        { id: 'T-block', label: 'T', color: '#800080', shape: [[0, 1, 0], [0, 1, 0], [1, 1, 1]] },
        { id: 'L-block', label: 'L', color: '#FFA500', shape: [[1, 0], [1, 0], [1, 0], [1, 1]] },
        { id: 'S-block', label: 'S', color: '#00FF00', shape: [[0, 1, 1], [1, 1, 0]] },
        { id: 'Z-block', label: 'Z', color: '#FF0000', shape: [[1, 1, 0], [0, 1, 0], [0, 1, 1]] },
        { id: 'N-block', label: 'N', color: '#A52A2A', shape: [[1, 1, 1, 0], [0, 0, 1, 1]] },
        { id: 'Q-block', label: 'Q', color: '#FFC0CB', shape: [[1, 1, 0], [1, 1, 1]] },
        { id: 'Y-block', label: 'Y', color: '#9370DB', shape: [[1, 0, 0],[1, 0, 0], [1, 1, 1]] },
        { id: 'U-block', label: 'U', color: '#FF6347', shape: [[1, 0, 1], [1, 1, 1]] },
        { id: 'l-block', label: 'l', color: '#008000', shape: [[1, 0], [1, 0], [1, 1]] },
      ]
    })
  },

  initializeBoard() {
    const initialBoardData = [
        [{ type: 'month', value: 'Jan' }, { type: 'month', value: 'Feb' }, { type: 'month', value: 'Mar' }, { type: 'month', value: 'Apr' }, { type: 'month', value: 'May' }, { type: 'month', value: 'Jun' }, { type: 'empty', value: null }],
        [{ type: 'month', value: 'Jul' }, { type: 'month', value: 'Aug' }, { type: 'month', value: 'Sep' }, { type: 'month', value: 'Oct' }, { type: 'month', value: 'Nov' }, { type: 'month', value: 'Dec' }, { type: 'empty', value: null }],
        [{ type: 'day', value: 1 }, { type: 'day', value: 2 }, { type: 'day', value: 3 }, { type: 'day', value: 4 }, { type: 'day', value: 5 }, { type: 'day', value: 6 }, { type: 'day', value: 7 }],
        [{ type: 'day', value: 8 }, { type: 'day', value: 9 }, { type: 'day', value: 10 }, { type: 'day', value: 11 }, { type: 'day', value: 12 }, { type: 'day', value: 13 }, { type: 'day', value: 14 }],
        [{ type: 'day', value: 15 }, { type: 'day', value: 16 }, { type: 'day', value: 17 }, { type: 'day', value: 18 }, { type: 'day', value: 19 }, { type: 'day', value: 20 }, { type: 'day', value: 21 }],
        [{ type: 'day', value: 22 }, { type: 'day', value: 23 }, { type: 'day', value: 24 }, { type: 'day', value: 25 }, { type: 'day', value: 26 }, { type: 'day', value: 27 }, { type: 'day', value: 28 }],
        [{ type: 'day', value: 29 }, { type: 'day', value: 30 }, { type: 'day', value: 31 }, { type: 'weekday', value: 'Sun' }, { type: 'weekday', value: 'Mon' }, { type: 'weekday', value: 'Tue' }, { type: 'weekday', value: 'Wed' }],
        [{ type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'empty', value: null }, { type: 'weekday', value: 'Thu' }, { type: 'weekday', value: 'Fri' }, { type: 'weekday', value: 'Sat' }]
      ];

    const today = new Date();
    const currentMonth = today.toLocaleString('en-US', { month: 'short' });
    const currentDay = today.getDate();
    const currentWeekday = today.toLocaleString('en-US', { weekday: 'short' });

    const boardWithUncovered = initialBoardData.map((row, y) => {
      return row.map((cell, x) => {
        const isUncovered = (
          (cell.type === 'month' && cell.value === currentMonth) ||
          (cell.type === 'day' && cell.value === currentDay) ||
          (cell.type === 'weekday' && cell.value === currentWeekday)
        );
        return { ...cell, x, y, isUncovered };
      });
    });

    this.setData({
      boardLayoutData: boardWithUncovered
    });
  },

  handleLongPress(e) {
    const { id } = e.currentTarget.dataset;
    let block = this.data.blockTypes.find(b => b.id === id) || this.data.droppedBlocks.find(b => b.id === id);
    if (!block) return;

    const touchX = e.touches[0].pageX;
    const touchY = e.touches[0].pageY;

    this.setData({
      blockTypes: this.data.blockTypes.filter(b => b.id !== id),
      droppedBlocks: this.data.droppedBlocks.filter(b => b.id !== id),
      'draggingBlock.isDragging': true,
      'draggingBlock.block': block,
      'draggingBlock.x': touchX,
      'draggingBlock.y': touchY,
    });
  },

  handleTouchMove(e) {
    if (!this.data.draggingBlock.isDragging) return;

    const touchX = e.touches[0].pageX;
    const touchY = e.touches[0].pageY;

    this.setData({
      'draggingBlock.x': touchX,
      'draggingBlock.y': touchY,
    });

    // --- Preview Logic ---
    const { gridInfo, CELL_SIZE, draggingBlock } = this.data;
    const gridX = Math.round((touchX - gridInfo.left) / CELL_SIZE);
    const gridY = Math.round((touchY - gridInfo.top) / CELL_SIZE);
    const isValid = this.isValidPlacement(draggingBlock.block, { x: gridX, y: gridY });

    this.setData({
      'previewBlock.shape': draggingBlock.block.shape,
      'previewBlock.x': gridX,
      'previewBlock.y': gridY,
      'previewBlock.isValid': isValid,
      'previewBlock.isVisible': true
    });
  },

  handleTouchEnd(e) {
    if (!this.data.draggingBlock.isDragging) return;

    this.setData({ 'previewBlock.isVisible': false });

    const { block, x, y } = this.data.draggingBlock;
    const { gridInfo, CELL_SIZE } = this.data;

    const gridX = Math.round((x - gridInfo.left) / CELL_SIZE);
    const gridY = Math.round((y - gridInfo.top) / CELL_SIZE);

    if (this.isValidPlacement(block, { x: gridX, y: gridY })) {
      const newBlock = { ...block, x: gridX, y: gridY };
      this.setData({
        droppedBlocks: [...this.data.droppedBlocks, newBlock],
      });
    } else {
      this.setData({
        blockTypes: [...this.data.blockTypes, block]
      });
    }

    this.setData({ 'draggingBlock.isDragging': false, 'draggingBlock.block': null });
  },

  isValidPlacement(block, newCoords) {
    const { boardLayoutData, droppedBlocks } = this.data;
    const blockCells = [];
    block.shape.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell === 1) {
          blockCells.push({
            x: newCoords.x + colIndex,
            y: newCoords.y + rowIndex,
          });
        }
      });
    });

    for (const cell of blockCells) {
      if (
        cell.y < 0 || cell.y >= boardLayoutData.length ||
        cell.x < 0 || cell.x >= boardLayoutData[0].length ||
        boardLayoutData[cell.y][cell.x].type === 'empty' ||
        boardLayoutData[cell.y][cell.x].isUncovered
      ) {
        return false;
      }
    }

    const allDroppedCells = droppedBlocks
      .filter(b => b.id !== block.id)
      .flatMap(b =>
        b.shape.flatMap((row, rIdx) =>
          row.map((c, cIdx) => (c === 1 ? { x: b.x + cIdx, y: b.y + rIdx } : null))
        ).filter(Boolean)
      );

    for (const blockCell of blockCells) {
      if (allDroppedCells.some(d => d.x === blockCell.x && d.y === blockCell.y)) {
        return false;
      }
    }

    return true;
  },

  handleShapeChange(e) {
    const { id, newShape } = e.detail;
    const blockTypes = this.data.blockTypes.map(b =>
      b.id === id ? { ...b, shape: newShape } : b
    );
    this.setData({ blockTypes });
  },

  // --- Tap and Double-Tap Handling ---
  lastTapTime: 0,
  lastTapId: null,

  handleTap(e) {
    const { id } = e.currentTarget.dataset;
    const currentTime = e.timeStamp;
    const lastTime = this.lastTapTime;

    if (currentTime - lastTime < 300 && id === this.lastTapId) {
      // Double tap
      this.handleDoubleClick(e);
    }

    this.lastTapTime = currentTime;
    this.lastTapId = id;
  },

  handleDoubleClick(e) {
    const { id } = e.currentTarget.dataset;
    const block = this.data.droppedBlocks.find(b => b.id === id);
    if (block) {
        this.setData({
            droppedBlocks: this.data.droppedBlocks.filter(b => b.id !== id),
            blockTypes: [...this.data.blockTypes, block]
        });
    }
  }
});
