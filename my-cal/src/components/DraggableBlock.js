import { useDrag } from 'react-dnd';
import { useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CELL_BOARDER, CELL_SIZE as GRID_CELL_SIZE } from './InitBoard';

const DraggableBlock = ({ 
  id, 
  label, 
  color = 'lightblue', 
  shape = [[1]],
  onRotate,
  onFlip,
  onDragStart,
  onDragEnd,
  onDoubleClick,
  isPlaced = false,
  style = {}
}) => {
  // Enhanced shape change tracking with component ID
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.debug(`[${timestamp}] DraggableBlock (ID: ${id}) received updated shape:`, JSON.stringify(shape));
  }, [shape, id]);

  // Debug state to track shape updates
  useEffect(() => {
    console.debug(`DraggableBlock (ID: ${id}) - component re-rendered with shape:`, JSON.stringify(shape));
  });
  // 使用网格的CELL_SIZE或提供的自定义大小
  const CELL_SIZE = isPlaced ? GRID_CELL_SIZE : 20;
  const GAP_SIZE = 3;
  
  // 使用useCallback确保在shape更新时重新创建函数
  // 这很重要，因为shape可能会异步更新，如果不使用useCallback，
  // getItem可能会捕获旧的shape值，导致拖拽时使用过时的形状
  const getItem = useCallback(() => {
    const timestamp = new Date().toLocaleTimeString();
    if (onDragStart) {
      onDragStart();
    }
    console.debug(`[${timestamp}] DraggableBlock (ID: ${id}) - getItem called with shape:`, JSON.stringify(shape));
    return { id, label, color, shape, cellSize: CELL_SIZE };
  }, [id, label, color, shape, CELL_SIZE, onDragStart]);

  // 添加shape到useDrag的依赖数组，确保shape变化时重新创建拖动配置
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'BLOCK',
    item: getItem,
    drop: (item, monitor) => {
      console.log('Drop block event triggered:', item);
    },
    end: (item, monitor) => {
      // 检查是否成功放置
      const didDrop = monitor.didDrop();
      if (onDragEnd) {
        onDragEnd(didDrop);
      }
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  // 明确添加shape到依赖数组，确保shape变化时重新创建拖动配置
  }), [getItem, onDragEnd]);

  const renderBlockShape = () => {
    return shape.map((row, rowIndex) => (
      <div key={rowIndex} style={{ display: 'flex' }}>
        {row.map((cell, cellIndex) => (
          <div 
            key={cellIndex} 
            style={{
              width: `${CELL_SIZE}px`, 
              height: `${CELL_SIZE}px`, 
              gap: `${GAP_SIZE}px`,
              backgroundColor: cell ? color : 'transparent',
              border: cell ? `${CELL_BOARDER}px solid black` : '1px solid transparent',
              boxSizing: 'border-box'
            }} 
          />
        ))}
      </div>
    ));
  };

  // 根据是否已放置调整样式
  const baseContainerStyle = isPlaced ? {    position: 'absolute',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
    boxShadow: 'none'
  } : {    backgroundColor: '#f0f0f0',
    border: '1px solid #333',
    display: 'inline-block',
    padding: '5px',
    margin: '5px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  // 合并基础样式和传入的样式
  const containerStyle = { ...baseContainerStyle, ...style };

  return (
    <div style={{...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      
      <div
        ref={drag}
        style={{opacity: isPlaced && isDragging ? 0.3 : (isDragging ? 0.5 : (isPlaced ? 0.8 : 1)),
          cursor: 'move',
          position: 'relative',
          zIndex: 1
        }}
        onDoubleClick={() => isPlaced && onDoubleClick && onDoubleClick(id)}
      >
        {renderBlockShape()}
      </div>
      {!isPlaced && (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '8px'}}>
            <div style={{display: 'flex', gap: '5px', marginBottom: '3px', justifyContent: 'center'}}>
              <button onClick={onRotate}>Rotate</button>
              <button onClick={onFlip}>Flip</button>
            </div>
            <div style={{fontSize: '20px', fontWeight: 'bold', color: '#333', textAlign: 'center'}}>{label}</div>
          </div>
        )}
    </div>
  );
};

DraggableBlock.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  shape: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  style: PropTypes.object,
  onDragEnd: PropTypes.func,
  onFlip: PropTypes.func,
  onDragStart: PropTypes.func,
  onRotate: PropTypes.func,
  onDoubleClick: PropTypes.func,
  isPlaced: PropTypes.bool
};

export default DraggableBlock;