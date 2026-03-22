import React, { useState, useEffect, useRef } from 'react';
import { View, Button } from '@tarojs/components';
import { BlockType } from '../types/game';
import { CELL_SIZE as GRID_CELL_SIZE, CELL_BOARDER } from './InitBoard';

interface DraggableBlockProps {
  id: string;
  label: string;
  color?: string;
  shape?: number[][];
  onRotate?: () => void;
  onFlip?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (didDrop: boolean, touchX?: number, touchY?: number) => void;
  onDoubleClick?: () => void;
  isPlaced?: boolean;
  style?: React.CSSProperties;
}

const DraggableBlock: React.FC<DraggableBlockProps> = ({
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
  const [isDragging, setIsDragging] = useState(false);
  const [currentShape, setCurrentShape] = useState(shape);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  
  const longPressTimerRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setCurrentShape(shape);
  }, [shape]);

  const CELL_SIZE = isPlaced ? GRID_CELL_SIZE : 20;
  const GAP_SIZE = 3;

  const handleTouchStart = (e: any) => {
    // Prevent page scroll
    e.stopPropagation?.();
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isDraggingRef.current = true;
    setIsDragging(true);

    if (onDragStart) {
      onDragStart();
    }

    setTouchPosition({ x: touch.clientX, y: touch.clientY });

    longPressTimerRef.current = window.setTimeout(() => {
      if (isDraggingRef.current && onFlip) {
        const flippedShape = shape.map((row: number[]) => [...row].reverse());
        setCurrentShape(flippedShape);
        onFlip();
      }
    }, 500);
  };

  const handleTouchMove = (e: any) => {
    if (!isDraggingRef.current) return;

    // Prevent page scroll during drag
    e.stopPropagation?.();
    e.preventDefault?.();

    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = (e: any) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    // Get final touch position
    const touch = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : null;
    const finalX = touch ? touch.clientX : touchPosition.x;
    const finalY = touch ? touch.clientY : touchPosition.y;

    if (timeSinceLastTap < 300) {
      if (isPlaced && onDoubleClick) {
        onDoubleClick();
      }
    } else {
      if (onDragEnd) {
        onDragEnd(true, finalX, finalY);
      }
    }

    lastTapTimeRef.current = now;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const renderBlockShape = () => {
    return currentShape.map((row: number[], rowIndex: number) => (
      <View key={rowIndex} style={{ display: 'flex' }}>
        {row.map((cell: number, cellIndex: number) => (
          <View
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
      </View>
    ));
  };

  const baseContainerStyle = isPlaced ? {
    position: 'absolute',
    backgroundColor: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
    boxShadow: 'none'
  } : {
    backgroundColor: '#f0f0f0',
    border: '1px solid #333',
    display: 'inline-block',
    padding: '5px',
    margin: '5px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const containerStyle = { ...baseContainerStyle, ...style };

  return (
    <View
      style={{...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center'}}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <View
        style={{
          opacity: isPlaced && isDragging ? 0.3 : (isDragging ? 0.5 : (isPlaced ? 0.8 : 1)),
          cursor: 'move',
          position: 'relative',
          zIndex: 1
        }}
      >
        {renderBlockShape()}
      </View>
      {!isPlaced && (
        <View style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', marginBottom: '8px'}}>
          <View style={{display: 'flex', gap: '5px', marginBottom: '3px', justifyContent: 'center'}}>
            <Button onClick={onRotate}>Rotate</Button>
            <Button onClick={onFlip}>Flip</Button>
          </View>
          <View style={{fontSize: '20px', fontWeight: 'bold', color: '#333', textAlign: 'center'}}>{label}</View>
        </View>
      )}
    </View>
  );
};

export default DraggableBlock;
