import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import { Block } from '../utils/gameUtils';

interface BlockComponentProps {
  block: Block;
  isPlaced: boolean;
  position?: { left: number; top: number };
  isPreview?: boolean;
  onRotate?: () => void;
  onFlip?: () => void;
  onReturn?: () => void;
  onSelect?: () => void;
}

const BlockComponent: React.FC<BlockComponentProps> = ({
  block,
  isPlaced,
  position,
  isPreview = false,
  onRotate,
  onFlip,
  onReturn,
  onSelect
}) => {
  const CELL_SIZE = isPlaced ? 70 : 25;
  const GAP_SIZE = 1;

  const renderBlockShape = () => {
    return block.shape.map((row, rowIndex) => (
      <View key={rowIndex} style={{ display: 'flex' }}>
        {row.map((cell, cellIndex) => (
          <View
            key={cellIndex}
            style={{
              width: `${CELL_SIZE}px`,
              height: `${CELL_SIZE}px`,
              backgroundColor: cell ? block.color : 'transparent',
              border: cell ? '1px solid rgba(0,0,0,0.3)' : '1px solid transparent',
              boxSizing: 'border-box',
              opacity: isPreview ? 0.6 : 1
            }}
          />
        ))}
      </View>
    ));
  };

  const containerStyle = isPlaced
    ? {
        position: 'absolute' as const,
        left: position?.left || 0,
        top: position?.top || 0,
        zIndex: isPreview ? 5 : 10,
        backgroundColor: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        boxShadow: 'none'
      }
    : {
        backgroundColor: '#f0f0f0',
        border: '1px solid #333',
        display: 'inline-block',
        padding: '5px',
        margin: '5px',
        boxSizing: 'border-box',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        borderRadius: '4px'
      };

  return (
    <View
      style={{
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
      onClick={!isPlaced ? onSelect : undefined}
    >
      <View style={{ cursor: isPlaced ? 'move' : 'pointer' }}>
        {renderBlockShape()}
      </View>
      
      {!isPlaced && (
        <View style={{ marginTop: 5, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 5 }}>
            {block.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <Button
              type="default"
              size="mini"
              onClick={(e) => {
                e.stopPropagation();
                onRotate?.();
              }}
              style={{ fontSize: 10, padding: '2px 4px', margin: 0 }}
            >
              旋转
            </Button>
            <Button
              type="default"
              size="mini"
              onClick={(e) => {
                e.stopPropagation();
                onFlip?.();
              }}
              style={{ fontSize: 10, padding: '2px 4px', margin: 0 }}
            >
              翻转
            </Button>
          </View>
        </View>
      )}

      {isPlaced && !isPreview && (
        <View style={{
          position: 'absolute',
          top: -25,
          left: 0,
          flexDirection: 'row',
          gap: 2
        }}>
          <Button
            type="primary"
            size="mini"
            onClick={(e) => {
              e.stopPropagation();
              onRotate?.();
            }}
            style={{ fontSize: 10, padding: '2px 4px', margin: 0 }}
          >
            转
          </Button>
          <Button
            type="primary"
            size="mini"
            onClick={(e) => {
              e.stopPropagation();
              onFlip?.();
            }}
            style={{ fontSize: 10, padding: '2px 4px', margin: 0 }}
          >
            翻
          </Button>
          <Button
            type="warn"
            size="mini"
            onClick={(e) => {
              e.stopPropagation();
              onReturn?.();
            }}
            style={{ fontSize: 10, padding: '2px 4px', margin: 0 }}
          >
            ×
          </Button>
        </View>
      )}
    </View>
  );
};

export default BlockComponent;