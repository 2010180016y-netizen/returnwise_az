import React from 'react';
import '../styles/index.css';
import { CalculatorPage } from '../features/calculator/CalculatorPage';
import { CalculatorErrorBoundary } from '../features/calculator/Actions';

export const App: React.FC = () => {
  return (
    <div className="rw-container">
      <main id="main-content">
        <CalculatorErrorBoundary>
          <CalculatorPage />
        </CalculatorErrorBoundary>
      </main>
    </div>
  );
};

export default App;
