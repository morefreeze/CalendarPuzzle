// components/DraggableBlock/DraggableBlock.js
Component({
  properties: {
    id: String,
    label: String,
    color: String,
    shape: Array,
    isPlaced: Boolean,
  },

  data: {
    currentShape: [],
  },

  lifetimes: {
    attached() {
      this.setData({
        currentShape: this.properties.shape,
      });
    }
  },

  methods: {
    // Rotate the shape clockwise by 90 degrees
    rotateShape() {
      const shape = this.data.currentShape;
      const rows = shape.length;
      const cols = shape[0].length;
      const newShape = Array(cols).fill(0).map(() => Array(rows).fill(0));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          newShape[col][rows - 1 - row] = shape[row][col];
        }
      }
      this.setData({ currentShape: newShape });
      this.triggerEvent('shapechange', { id: this.properties.id, newShape: newShape });
    },

    // Flip the shape horizontally
    flipShape() {
      const shape = this.data.currentShape;
      const newShape = shape.map(row => [...row].reverse());
      this.setData({ currentShape: newShape });
      this.triggerEvent('shapechange', { id: this.properties.id, newShape: newShape });
    },

    onLongPress(e) {
      this.triggerEvent('longpress', { id: this.properties.id, x: e.touches[0].pageX, y: e.touches[0].pageY });
    },

    onDoubleClick() {
        if (this.properties.isPlaced) {
            this.triggerEvent('doubleclick', { id: this.properties.id });
        }
    }
  }
})
