import React, { useState, useEffect, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import GridCell from './GridCell';
import {
  CELL_BOARDER,
  GAP_SIZE,
  boardLayoutData,
  initialBlockTypes,
  formatTime,
  getUncoverableCells
} from './InitBoard';
import { useGameInitialization } from '../hooks/useGameInitialization';
import { BlockType, PlacedBlock, UncoverableCell } from '../types/game';

// 屏幕边距余量（左右各留的边距）
const SCREEN_MARGIN = 32;

const BoardPreview = () => {
  const { gameId, loading: initLoading } = useGameInitialization();
  const [timer, setTimer] = useState(0);
  const [cellSize, setCellSize] = useState(70);

  useEffect(() => {
    const systemInfo = Taro.getSystemInfoSync();
    const screenWidth = systemInfo.windowWidth || systemInfo.screenWidth;
    const cols = boardLayoutData[0].length;
    // 计算每个格子的尺寸：(屏幕宽度 - 边距) / 列数 - 间隙，再缩小20%
    const availableWidth = screenWidth - SCREEN_MARGIN;
    const calculatedCellSize = Math.floor((availableWidth - (cols - 1) * GAP_SIZE) / cols * 0.8);
    setCellSize(calculatedCellSize);
  }, []);

  useEffect(() => {
    if (initLoading) return;
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [initLoading]);

  const uncoverableCells = useMemo(() => getUncoverableCells(), []);

  if (initLoading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#333' }}>
        Time: {formatTime(timer)}
      </Text>

      <Text style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '10px'
      }}>
        Game ID: {gameId}
      </Text>

      <Text style={{
        fontSize: '12px',
        color: '#888',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        Demo Mode - Static Board Preview
      </Text>

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${boardLayoutData[0].length}, ${cellSize}px)`,
          gap: `${GAP_SIZE}px`,
          marginBottom: '20px',
          border: '10px solid #333',
          padding: '0px',
          backgroundColor: '#f5f5f5'
        }}
      >
        {boardLayoutData.flatMap((row, y) =>
          row.map((cell, x) => {
            const canDrop = cell.type !== 'empty';
            const isUncovered = uncoverableCells.some((c: UncoverableCell) => c.x === x && c.y === y);
            return (
              <GridCell
                key={`${y}-${x}`}
                label={canDrop ? cell.value.toString() : ''}
                section={isUncovered ? 'uncover' : cell.type}
                x={x}
                y={y}
                canDrop={canDrop}
                size={cellSize}
              />
            );
          })
        )}
      </View>

      <Text style={{
        fontSize: '16px',
        color: '#666',
        marginBottom: '10px'
      }}>
        Available Blocks ({initialBlockTypes.length})
      </Text>

      <View style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {initialBlockTypes.map((block: BlockType) => (
          <View
            key={block.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '5px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff'
            }}
          >
            <Text style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
              {block.label}
            </Text>
            <View style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${block.shape[0].length}, 20px)`,
              gap: '1px'
            }}>
              {block.shape.map((row, rIdx) =>
                row.map((cell, cIdx) => (
                  <View
                    key={`${rIdx}-${cIdx}`}
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: cell ? block.color : 'transparent',
                      border: '1px solid rgba(0,0,0,0.2)',
                      boxSizing: 'border-box'
                    }}
                  />
                ))
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export default BoardPreview;
