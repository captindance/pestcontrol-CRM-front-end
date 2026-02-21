import React from 'react';
import ExternalSchedulesWidget from './ExternalSchedulesWidget.jsx';
import DashboardStatsWidget from './DashboardStatsWidget.jsx';

export default function Dashboard({ showToast }) {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <DashboardStatsWidget showToast={showToast} />
      
      <ExternalSchedulesWidget showToast={showToast} />
    </div>
  );
}
