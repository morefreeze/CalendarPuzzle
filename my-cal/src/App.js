import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import CalendarGrid from './components/CalendarGrid';
import './App.css';

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="App">
        <h1>日历拼图游戏</h1>
        <CalendarGrid />
      </div>
    </DndProvider>
  );
}

export default App;