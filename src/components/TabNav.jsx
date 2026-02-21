import React from 'react';

/**
 * Accessible Tab Navigation Component
 * Section 508 / WCAG 2.1 AA Compliant
 * 
 * Features:
 * - Full keyboard navigation (Arrow keys, Home, End)
 * - Screen reader support (ARIA roles)
 * - Disabled state with explanatory tooltips
 * - Focus management
 */
export default function TabNav({ tabs, activeTab, onTabChange, selectedSchedule }) {
  const tabRefs = React.useRef([]);

  const handleKeyDown = (e, index) => {
    let newIndex = index;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = index > 0 ? index - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        e.preventDefault();
        newIndex = index < tabs.length - 1 ? index + 1 : 0;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    // Focus and activate the new tab (if not disabled)
    if (tabRefs.current[newIndex] && !tabs[newIndex].disabled) {
      tabRefs.current[newIndex].focus();
      onTabChange(tabs[newIndex].id);
    } else if (tabRefs.current[newIndex]) {
      // Just focus disabled tab (don't activate)
      tabRefs.current[newIndex].focus();
    }
  };

  const handleClick = (tab) => {
    if (!tab.disabled) {
      onTabChange(tab.id);
    }
  };

  return (
    <div 
      role="tablist" 
      aria-label="Schedule Management Tabs"
      style={{
        display: 'flex',
        borderBottom: '2px solid #4b5563',
        marginBottom: '1.5rem',
        gap: '0.5rem'
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;
        const disabledLabel = isDisabled && tab.requiresSelection && !selectedSchedule
          ? ` (Select a schedule first)`
          : '';

        return (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[index] = el)}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            aria-disabled={isDisabled}
            aria-label={`${tab.label}${disabledLabel}`}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => handleClick(tab)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            title={isDisabled ? `${tab.label}${disabledLabel}` : tab.label}
            style={{
              padding: '0.75rem 1.5rem',
              background: isActive ? '#7c3aed' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '3px solid #7c3aed' : '3px solid transparent',
              color: isDisabled ? '#6b7280' : '#fff',
              fontSize: '1rem',
              fontWeight: isActive ? '600' : '500',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              transition: 'all 0.2s',
              outline: 'none',
              position: 'relative'
            }}
            onFocus={(e) => {
              // Add visible focus indicator
              e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.5)';
            }}
            onBlur={(e) => {
              e.target.style.boxShadow = 'none';
            }}
          >
            {tab.icon && <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
