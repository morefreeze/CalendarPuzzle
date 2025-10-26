import React, { useState, useEffect } from 'react';
import CustomConfig from './CustomConfig';
import './CustomGameMode.css';
import CustomBoardEditor from './CustomBoardEditor';

const CustomGameMode = ({ onCustomGameCreated }) => {
  const [config, setConfig] = useState({
    boardSize: { rows: 8, cols: 7 },
    selectedBlockTypes: [],
    customLayout: { type: 'calendar' },
    difficulty: 'medium',
    customBoard: [] // 自定义棋盘配置
  });
  const [showBoardEditor, setShowBoardEditor] = useState(false); // 显示棋盘编辑器

  const [templates, setTemplates] = useState([]);
  const [difficultyLevels, setDifficultyLevels] = useState([]);
  const [blockTypes, setBlockTypes] = useState([]);
  const [boardSizeLimits, setBoardSizeLimits] = useState({
    minRows: 6, maxRows: 12, minCols: 6, maxCols: 12
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取配置模板和数据
  useEffect(() => {
    // 使用本地配置数据而不是从API获取
    const templates = CustomConfig.getLayoutTemplates();
    const difficultyLevels = CustomConfig.getDifficultyLevels();
    const blockTypes = CustomConfig.getAvailableBlockTypes();
    const boardSizeLimits = CustomConfig.getBoardSizeLimits();
    
    setTemplates(templates);
    setDifficultyLevels(difficultyLevels);
    setBlockTypes(blockTypes);
    setBoardSizeLimits(boardSizeLimits);
    
    // 设置默认选中的方块类型和前6个方块
    if (config.selectedBlockTypes.length === 0) {
      setConfig(prevConfig => ({
        ...prevConfig,
        selectedBlockTypes: blockTypes.slice(0, 6).map(block => block.id)
      }));
    }
  }, [config.selectedBlockTypes.length]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleBoardSizeChange = (dimension, value) => {
    const newValue = Math.max(boardSizeLimits[`min${dimension === 'rows' ? 'Rows' : 'Cols'}`], 
                               Math.min(boardSizeLimits[`max${dimension === 'rows' ? 'Rows' : 'Cols'}`], value));
    
    setConfig(prevConfig => ({
      ...prevConfig,
      boardSize: {
        ...prevConfig.boardSize,
        [dimension]: newValue
      }
    }));
  };

  const handleBlockTypeToggle = (blockTypeId) => {
    setConfig(prevConfig => {
      const newSelected = prevConfig.selectedBlockTypes.includes(blockTypeId)
        ? prevConfig.selectedBlockTypes.filter(id => id !== blockTypeId)
        : [...prevConfig.selectedBlockTypes, blockTypeId];
      
      return {
        ...prevConfig,
        selectedBlockTypes: newSelected
      };
    });
  };

  const handleLayoutChange = (layoutType) => {
    setConfig(prev => ({
      ...prev,
      customLayout: { type: layoutType }
    }));
    
    // 如果是自定义布局模式，显示棋盘编辑器
    if (layoutType === 'custom') {
      setShowBoardEditor(true);
    } else {
      setShowBoardEditor(false);
    }
  };

  const handleDifficultyChange = (difficulty) => {
    const level = difficultyLevels.find(level => level.id === difficulty);
    if (level) {
      setConfig(prevConfig => ({
        ...prevConfig,
        difficulty: difficulty,
        boardSize: level.boardSize
      }));
    }
  };

  // 处理棋盘变化
  const handleBoardChange = (board) => {
    setConfig(prev => ({ ...prev, customBoard: board }));
  };

  const createCustomGame = async () => {
    if (config.selectedBlockTypes.length === 0) {
      setError('Please select at least one block type');
      return;
    }

    // 如果是自定义布局，验证棋盘配置
    if (config.customLayout.type === 'custom' && config.customBoard.length > 0) {
      const selectedCells = config.customBoard.flat().filter(cell => cell).length;
      const totalCells = config.boardSize.rows * config.boardSize.cols;
      const requiredCells = totalCells - 3; // 减去3个日期格子
      
      if (selectedCells !== requiredCells) {
        setError(`Selected cells (${selectedCells}) must equal required cells (${requiredCells})`);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      // 创建自定义配置
      const customConfig = new CustomConfig({
        boardSize: config.boardSize,
        blockTypes: config.selectedBlockTypes,
        layoutType: config.customLayout.type,
        difficulty: config.difficulty,
        customBoard: config.customBoard
      });
      
      // 验证配置
      customConfig.validate();
      
      // 转换为API格式并发送到后端
      const apiConfig = customConfig.toApiFormat();
      
      const response = await fetch('http://localhost:5001/api/custom-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiConfig)
      });

      const data = await response.json();
      
      if (data.success) {
        // 转换后端返回的boardLayout数据为前端需要的格式
        const gameData = {
          ...data,
          boardLayout: data.boardLayout ? data.boardLayout.map(row => {
            return row.split('').map(cell => {
              if (cell === ' ') {
                return { type: 'empty', value: null };
              } else {
                return { type: 'custom', value: cell };
              }
            });
          }) : null
        };
        
        if (onCustomGameCreated) {
          onCustomGameCreated(gameData);
        }
        // 显示成功消息
        alert('自定义游戏创建成功！');
        console.log('自定义游戏数据已发送:', gameData);
      } else {
        setError(data.error || 'Failed to create custom game');
      }
    } catch (error) {
      console.error('Error creating custom game:', error);
      setError(error.message || 'Failed to create custom game');
    } finally {
      setIsLoading(false);
    }
  };

  const renderLayoutPreview = () => {
    const { rows, cols } = config.boardSize;
    const previewSize = Math.min(200 / Math.max(rows, cols), 20);
    
    return (
      <div className="layout-preview" style={{ 
        gridTemplateColumns: `repeat(${cols}, ${previewSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${previewSize}px)`
      }}>
        {Array.from({ length: rows * cols }).map((_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          let cellClass = 'preview-cell';
          
          // 根据布局类型设置不同的预览样式
          switch (config.customLayout.type) {
            case 'calendar':
              if ((row === 0 && col === 0) || (row === rows - 1 && col === cols - 1)) {
                cellClass += ' blocked';
              }
              break;
            case 'symmetric':
              if (row === 0 || row === rows - 1 || col === 0 || col === cols - 1) {
                cellClass += ' blocked';
              }
              break;
            case 'random':
              // 简单的随机效果
              if (Math.random() < 0.2) {
                cellClass += ' blocked';
              }
              break;
            default:
              break;
          }
          
          return <div key={index} className={cellClass} />;
        })}
      </div>
    );
  };

  return (
    <div className="custom-game-mode">
      <h2>Custom Game Configuration</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* 难度选择 */}
      <div className="config-section">
        <h3>Difficulty Level</h3>
        <div className="difficulty-buttons">
          {difficultyLevels.map(level => (
            <button
              key={level.id}
              className={`difficulty-btn ${config.difficulty === level.id ? 'active' : ''}`}
              onClick={() => handleDifficultyChange(level.id)}
            >
              {level.name}
            </button>
          ))}
        </div>
      </div>

      {/* 棋盘尺寸 */}
      <div className="config-section">
        <h3>Board Size</h3>
        <div className="board-size-controls">
          <div className="size-control">
            <label>Rows:</label>
            <input
              type="number"
              min={boardSizeLimits.minRows}
              max={boardSizeLimits.maxRows}
              value={config.boardSize.rows}
              onChange={(e) => handleBoardSizeChange('rows', parseInt(e.target.value))}
            />
          </div>
          <div className="size-control">
            <label>Columns:</label>
            <input
              type="number"
              min={boardSizeLimits.minCols}
              max={boardSizeLimits.maxCols}
              value={config.boardSize.cols}
              onChange={(e) => handleBoardSizeChange('cols', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* 方块类型选择 - 移到棋盘上方 */}
      <div className="config-section">
        <h3>选择方块类型</h3>
        <div className="block-type-grid">
          {blockTypes.map(blockType => (
            <div key={blockType.id} className="block-type-option">
              <input
                type="checkbox"
                id={`block-${blockType.id}`}
                checked={config.selectedBlockTypes.includes(blockType.id)}
                onChange={() => handleBlockTypeToggle(blockType.id)}
              />
              <label htmlFor={`block-${blockType.id}`}>
                <div className="block-shape-preview">
                  <div className="block-shape-text">{blockType.shape}</div>
                </div>
                <div className="block-shape-name">{blockType.name}</div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* 自定义棋盘编辑器 */}
      {showBoardEditor && (
        <div className="config-section">
          <CustomBoardEditor
            boardSize={config.boardSize}
            onBoardChange={handleBoardChange}
            selectedBlocks={config.selectedBlockTypes}
          />
        </div>
      )}

      {/* 布局类型 */}
      <div className="config-section">
        <h3>布局类型</h3>
        <div className="layout-type-selector">
          {templates.map(template => (
            <button
              key={template.id}
              className={`layout-type-btn ${config.customLayout.type === template.id ? 'active' : ''}`}
              onClick={() => handleLayoutChange(template.id)}
            >
              {template.name}
            </button>
          ))}
        </div>
        
        {/* 布局预览 */}
        <div className="layout-preview-container">
          <h4>Preview</h4>
          {renderLayoutPreview()}
        </div>
      </div>

      {/* 创建游戏按钮 */}
      <div className="config-actions">
        <button 
          className="create-game-btn"
          onClick={createCustomGame}
          disabled={isLoading || config.selectedBlockTypes.length === 0}
        >
          {isLoading ? 'Creating...' : 'Create Custom Game'}
        </button>
      </div>
    </div>
  );
};

export default CustomGameMode;