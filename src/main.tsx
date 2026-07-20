/**
 * The Belfry — application entry point.
 *
 * Copyright (c) 2026 roninchris
 * SPDX-License-Identifier: MIT
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
