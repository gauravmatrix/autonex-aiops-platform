import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Anomalies from './pages/Anomalies';
import Incidents from './pages/Incidents';
import Metrics from './pages/Metrics';
import Demo from './pages/Demo';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="anomalies" element={<Anomalies />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="demo" element={<Demo />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
