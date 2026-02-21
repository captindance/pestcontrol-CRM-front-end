import React, { useState } from 'react';

export default function ExternalRecipientWarning({ externalEmails, onConfirm, onCancel }) {
  const [checkError, setCheckError] = useState(false);
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content warning-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header warning-header">
          <h2>⚠️ External Recipients Detected</h2>
        </div>
        
        <div className="modal-body">
          <p className="warning-message">
            This schedule will send reports to <strong>{externalEmails.length}</strong> external email address(es):
          </p>
          
          <ul className="external-email-list">
            {externalEmails.map((email) => (
              <li key={email}>
                <span className="external-badge">🌐</span>
                <strong>{email}</strong>
              </li>
            ))}
          </ul>
          
          <div className="warning-notice">
            <strong>Important:</strong> External recipients are outside your organization. 
            Ensure you have authorization to share report data with these addresses.
          </div>
          
          <div className="confirmation-checkbox">
            <label>
              <input type="checkbox" id="confirm-external" onChange={() => setCheckError(false)} />
              I confirm this schedule should send to external recipients
            </label>
            {checkError && (
              <p style={{ color: '#ef4444', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                Please check the box to confirm before continuing.
              </p>
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn-warning" 
            onClick={() => {
              const checkbox = document.getElementById('confirm-external');
              if (checkbox && checkbox.checked) {
                setCheckError(false);
                onConfirm();
              } else {
                setCheckError(true);
              }
            }}
          >
            Continue with External Recipients
          </button>
        </div>
      </div>
    </div>
  );
}
