# Agent System Documentation

This repository contains specialized AI agents for the **Frontend** (React/Vite/JavaScript).

## Agents in This Repository

### 1. **Frontend Coding Agent** (`frontend-coding-agent.md`)
**Purpose**: Implement frontend features, UI components, and user experiences
- React 18 components with hooks
- CSS Modules for styling
- API integration (fetch/axios)
- Real-time updates with SSE
- State management and routing

### 2. **Frontend Security Agent** (`frontend-security-agent.md`)
**Purpose**: Identify and prevent frontend security vulnerabilities
- XSS (Cross-Site Scripting) prevention
- CSRF protection
- Token security (localStorage best practices)
- API security (authentication headers)
- Monthly vulnerability monitoring
- OWASP Top 10 compliance

### 3. **Frontend Testing Agent** (`frontend-testing-agent.md`)
**Purpose**: Test frontend functionality, UI/UX, and React components
- Unit tests (components, hooks, utilities)
- Integration tests (features, multi-component flows)
- End-to-end tests (critical user journeys with Playwright)
- Accessibility testing (@axe-core/react)
- Security test cases
- Email testing with captindanceman@yahoo.com

### 4. **Code Review Agent** (`code-review-agent.md`)
**Purpose**: Ensure code quality, maintainability, and best practices
- Reviews frontend and backend code
- Debates with coding agents on implementation approach
- Ensures dynamic, robust, reusable patterns
- Researches current best practices
- **Shared between backend and frontend repos**

### 5. **Dev Server Monitor** (`dev-server-monitor.md`)
**Purpose**: Keep development servers running with automatic crash recovery
- Monitors frontend (Vite on port 3000) and backend (Express on port 3001)
- Auto-restarts crashed servers
- Logs all activity for debugging
- **Shared between backend and frontend repos**

## How to Use Agents

### Working on Frontend Features
1. **Planning**: Consult Code Review Agent for component architecture
2. **Implementation**: Frontend Coding Agent builds components and UI
3. **Security Review**: Frontend Security Agent reviews for XSS, token issues
4. **Testing**: Frontend Testing Agent creates comprehensive tests
5. **Monitoring**: Dev Server Monitor keeps frontend running during development

### Agent Collaboration Flow
```
Code Review Agent (architecture/quality gate)
    ↓
Frontend Coding Agent (component implementation)
    ↓
Frontend Security Agent (security review)
    ↓
Frontend Testing Agent (test and verify)
```

### Cross-Repo Collaboration
Frontend agents also work with backend agents:
- **Frontend Coding** ↔ **Backend Coding**: API contracts
- **Frontend Security** ↔ **Backend Security**: Authentication flow
- **Frontend Testing** ↔ **Backend Testing**: Integration test scenarios

## Frontend Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: JavaScript (not TypeScript)
- **Styling**: CSS Modules (NOT inline styles)
- **Routing**: React Router v6
- **API Client**: fetch API
- **Real-time**: Server-Sent Events (SSE)
- **Testing**: Vitest, React Testing Library, Playwright
- **Port**: 3000

## Styling Standards

**IMPORTANT**: Use CSS Modules, NOT inline styles

```jsx
// ✅ CORRECT - CSS Modules
import styles from './Button.module.css';

function Button({ children, onClick }) {
  return (
    <button className={styles.button} onClick={onClick}>
      {children}
    </button>
  );
}
```

```css
/* Button.module.css */
.button {
  background-color: var(--primary-color);
  padding: 10px 20px;
  border-radius: 4px;
}
```

❌ **INCORRECT** - Inline styles (don't use):
```jsx
<button style={{ backgroundColor: 'blue', padding: '10px' }}>
```

## Component Structure

```
src/
├── components/        # Reusable UI components
│   ├── Button/
│   │   ├── Button.jsx
│   │   └── Button.module.css
│   └── ...
├── pages/            # Route pages
├── hooks/            # Custom React hooks
├── utils/            # Utilities
└── api.js            # API client
```

## Security Priorities

1. **XSS Prevention**: Sanitize user input, use textContent not innerHTML
2. **Token Security**: HttpOnly cookies preferred, avoid localStorage for sensitive tokens
3. **CSRF Protection**: Include CSRF tokens from backend
4. **API Security**: Always include authentication headers
5. **Content Security Policy**: Validate response types

## Testing Requirements

- **70% unit tests**: Components, hooks, utilities
- **20% integration tests**: Features, multi-component flows
- **10% E2E tests**: Critical user journeys
- **80%+ code coverage**
- Zero flaky tests
- Email tests use captindanceman@yahoo.com (manual verification)

## Accessibility Standards

- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance (WCAG 2.1 AA)

## Coding Standards

See `frontend/.github/copilot-instructions.md` for detailed standards:
- Functional components with hooks
- Proper prop validation
- CSS Modules for all styling
- Descriptive component and function names
- Comprehensive comments for complex logic

## Related Documentation

- **Backend Agents**: See `backend/.copilot/agents/README.md`
- **Frontend Copilot Instructions**: `frontend/.github/copilot-instructions.md`

---

**Remember**: These agents work together. Frontend Coding Agent implements UI, Security Agent reviews vulnerabilities, Testing Agent verifies functionality, and Code Review Agent ensures quality. Communication with backend agents ensures full-stack consistency.
