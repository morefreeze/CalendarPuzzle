import React, { useState, useEffect } from 'react';
import './CustomBoardEditor.css';

const CustomBoardEditor = ({ boardSize, onBoardChange, selectedBlocks }) => {
  const [board, setBoard] = useState([]);
  const [totalCells, setTotalCells] = useState(0);
  const [selectedCells, setSelectedCells] = useState(0);
  const [requiredCells, setRequiredCells] = useState(0);

  // 初始化棋盘
  useEffect(() => {
    const newBoard = Array(boardSize.rows).fill(null).map(() => 
      Array(boardSize.cols).fill(false)
    );
    setBoard(newBoard);
    setTotalCells(boardSize.rows * boardSize.cols);
    setSelectedCells(0);
  }, [boardSize]);

  // 计算所需格子数（总格子数 - 日期格子数（3个））
  useEffect(() => {
    if (selectedBlocks && selectedBlocks.length > 0) {
      // 这里需要根据方块类型计算总格子数
      // 简化处理：假设每个方块平均占用4个格子
      const required = totalCells - 3; // 减去3个日期格子
      setRequiredCells(required);
    } else {
      setRequiredCells(0);
    }
  }, [selectedBlocks, totalCells, selectedCells]);

  // 切换格子状态
  const toggleCell = (row, col) => {
    const newBoard = board.map((r, rIndex) =>
      r.map((cell, cIndex) => {
        if (rIndex === row && cIndex === col) {
          return !cell;
        }
        return cell;
      })
    );
    
    setBoard(newBoard);
    
    // 计算选中的格子数
    const newSelectedCount = newBoard.flat().filter(cell => cell).length;
    setSelectedCells(newSelectedCount);
    
    // 通知父组件
    if (onBoardChange) {
      onBoardChange(newBoard);
    }
  };

  // 验证棋盘配置
  const validateBoard = () => {
    if (selectedCells === 0) {
      return { valid: false, message: '请至少选择一个格子' };
    }
    
    if (requiredCells > 0 && selectedCells !== requiredCells) {
      return { 
        valid: false, 
        message: `选择的格子数(${selectedCells})必须等于所需格子数(${requiredCells})`
      };
    }
    
    return { valid: true, message: '配置有效' };
  };

  const validation = validateBoard();

  return (
    <div className="custom-board-editor">
      <div className="board-header">
        <h3>自定义棋盘</h3>
        <div className="board-stats">
          <span className="stat">
            总格子: {totalCells}
          </span>
          <span className="stat">
            已选: {selectedCells}
          </span>
          {requiredCells > 0 && (
            <span className="stat required">
              需要: {requiredCells}
            </span>
          )}
        </div>
      </div>
      
      <div className="board-container">
        <div 
          className="custom-board"
          style={{
            gridTemplateColumns: `repeat(${boardSize.cols}, 30px)`,
            gridTemplateRows: `repeat(${boardSize.rows}, 30px)`
          }}
        >
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`board-cell ${cell ? 'selected' : ''}`}
                onClick={() => toggleCell(rowIndex, colIndex)}
                title={`位置: (${rowIndex + 1}, ${colIndex + 1})`}
              >
                {cell && <div className="cell-indicator"></div>}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="validation-status">
        <div className={`validation-message ${validation.valid ? 'valid' : 'invalid'}`}>
          {validation.message}
        </div>
      </div>
      
      <div className="board-instructions">
        <p>💡 点击格子来选择或取消选择</p>
        <p>📊 所需格子数 = 总格子数 - 3个日期格子</p>
        <p>🎯 确保选择的格子数与方块总格子数匹配</p>
      </div>
    </div>
  );
};

export default CustomBoardEditor;