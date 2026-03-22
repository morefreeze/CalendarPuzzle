import React, { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';

interface ToastProps {
  message: string;
  duration?: number;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  duration = 3000,
  type = 'info',
  visible,
  onClose
}) => {
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible) {
    return null;
  }

  const backgroundColors = {
    success: '#4CAF50',
    error: '#f44336',
    info: '#2196F3'
  };

  return (
    <View
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '20px',
        borderRadius: '8px',
        zIndex: 9999,
        minWidth: '200px',
        maxWidth: '80%'
      }}
    >
      <View
        style={{
          backgroundColor: backgroundColors[type],
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '4px',
          textAlign: 'center',
          fontSize: '14px'
        }}
      >
        {message}
      </View>
    </View>
  );
};

export default Toast;
