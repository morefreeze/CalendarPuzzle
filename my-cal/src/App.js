import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useState } from 'react';
import CalendarGrid from './components/CalendarGrid';
import CustomGameMode from './components/CustomGameMode';
import { createCustomOrderedGameData } from './components/InitBoard';
import './App.css';

function App() {
  const [currentMode, setCurrentMode] = useState('standard');
  const [customGameData, setCustomGameData] = useState(null);

  const handleCustomGameCreated = (gameData) => {
    setCustomGameData(gameData);
    setCurrentMode('standard'); // 创建完成后返回标准模式
  };

  const handleCreateOrderedGame = () => {
    const orderedGameData = createCustomOrderedGameData();
    setCustomGameData(orderedGameData);
    setCurrentMode('standard');
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="App">
        <h1>日历拼图游戏</h1>
        
        {/* 模式切换按钮 */}
        <div className="mode-switcher">
          <button 
            className={currentMode === 'standard' ? 'active' : ''}
            onClick={() => setCurrentMode('standard')}
          >
            标准模式
          </button>
          <button 
            className={currentMode === 'custom' ? 'active' : ''}
            onClick={() => setCurrentMode('custom')}
          >
            自定义模式
          </button>
          <button 
            className="ordered-mode-button"
            onClick={handleCreateOrderedGame}
          >
            有序模式（显示月份、日期、星期）
          </button>
        </div>

        {/* 根据模式显示不同内容 */}
        {currentMode === 'standard' ? (
          <CalendarGrid customGameData={customGameData} />
        ) : (
          <CustomGameMode onCustomGameCreated={handleCustomGameCreated} />
        )}
      </div>
    </DndProvider>
  );
}

export default App;