import React, { useState, useEffect } from 'react';
import CustomConfig from './CustomConfig';
import './CustomGameMode.css';

const CustomGameMode = ({ onCustomGameCreated }) => {
  const [config, setConfig] = useState({
    boardSize: { rows: 8, cols: 7 },
    selectedBlockTypes: [],
    customLayout: { type: 'calendar' },
    difficulty: 'medium'
  });

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
  }, []);

  const fetchCustomTemplates = async () => {
    // 这个方法现在不需要了，因为我们在useEffect中直接使用本地数据
  };

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
    setConfig(prevConfig => ({
      ...prevConfig,
      customLayout: { type: layoutType }
    }));
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

  const createCustomGame = async () => {
    if (config.selectedBlockTypes.length === 0) {
      setError('Please select at least one block type');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 创建自定义配置
      const customConfig = new CustomConfig({
        boardSize: config.boardSize,
        blockTypes: config.selectedBlockTypes,
        layoutType: config.customLayout.type,
        difficulty: config.difficulty
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
        if (onCustomGameCreated) {
          onCustomGameCreated(data);
        }
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

      {/* 布局类型 */}
      <div className="config-section">
        <h3>Layout Type</h3>
        <div className="layout-types">
          {templates.map(template => (
            <div key={template.id} className="layout-option">
              <label>
                <input
                  type="radio"
                  name="layout"
                  value={template.id}
                  checked={config.customLayout.type === template.id}
                  onChange={() => handleLayoutChange(template.id)}
                />
                <span>{template.name}</span>
              </label>
              <p className="layout-description">{template.description}</p>
            </div>
          ))}
        </div>
        
        {/* 布局预览 */}
        <div className="layout-preview-container">
          <h4>Preview</h4>
          {renderLayoutPreview()}
        </div>
      </div>

      {/* 方块类型选择 */}
      <div className="config-section">
        <h3>Available Block Types ({config.selectedBlockTypes.length} selected)</h3>
        <div className="block-types-grid">
          {blockTypes.map(blockType => (
            <div key={blockType.id} className="block-type-option">
              <label>
                <input
                  type="checkbox"
                  checked={config.selectedBlockTypes.includes(blockType.id)}
                  onChange={() => handleBlockTypeToggle(blockType.id)}
                />
                <span>{blockType.name}</span>
              </label>
              <div className="block-shape-preview">
                {/* 这里可以添加方块形状的预览 */}
                <span className="block-shape-text">{blockType.id}</span>
              </div>
            </div>
          ))}
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