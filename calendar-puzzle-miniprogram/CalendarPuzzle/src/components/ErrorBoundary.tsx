import React, { Component, ReactNode } from 'react';
import { View, Button, Text } from '@tarojs/components';
import { logError } from '../utils/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('Component error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          minHeight: '100vh',
          backgroundColor: '#fff'
        }}>
          <Text style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#f44336',
            marginBottom: '10px',
            textAlign: 'center'
          }}>
            Oops! Something went wrong.
          </Text>
          <Text style={{
            fontSize: '14px',
            color: '#666',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Button
            onClick={this.handleRetry}
            style={{
              backgroundColor: '#4CAF50',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '4px'
            }}
          >
            Try Again
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
