# Frontend Copilot Instructions

## Project Overview
This is the **frontend** for the PestControl CRM system - a multi-tenant, read-only reporting platform for the pest control industry. It is a single-page application built with React and Vite, providing the user interface for report visualization and system management.

## Tech Stack
- **Framework**: React 18 (functional components with hooks)
- **Build Tool**: Vite 5
- **Routing**: React Router v6
- **Language**: JavaScript (JSX) - not TypeScript
- **Styling**: Inline styles (no CSS framework/library)
- **Real-time**: Server-Sent Events (EventSource) for live updates

## Architecture
- **Entry Point**: `src/main.jsx`
- **Root Component**: `src/App.jsx` (main application state and routing logic)
- **Components**: Reusable UI components in `src/components/`
  - `Login.jsx` - Login form
  - `Signup.jsx` - User registration
  - `VerifyEmail.jsx` - Email verification flow
  - `AdminPanel.jsx` - Platform admin dashboard (clients, managers, invitations)
  - `ClientPanel.jsx` - Client/business owner dashboard
  - `DatabaseConnections.jsx` - Connection management UI
  - `ReportChart.jsx` - Chart visualization for reports
  - `ReportsView.jsx` - Report listing and execution
  - `Sidebar.jsx` - Navigation sidebar
  - `MainLayout.jsx` - Layout wrapper
  - `TenantSelector.jsx` - Multi-tenant selector for managers
  - `NavTabs.jsx` - Tab navigation component
  - `CapabilitiesPanel.jsx` - Capabilities/permissions view
- **API Client**: All backend communication in `src/api.js`
- **Authentication**: Auth utilities and token management in `src/auth.js`
- **Custom Hooks**: React hooks in `src/hooks/` (if any)

## Key Guidelines

### Separation of Concerns
- **This is frontend code only** - do not create or modify backend APIs, database schemas, or server-side logic
- All data comes from the backend REST API via functions in `src/api.js`
- Do not implement business logic, validation, or data processing that belongs on the backend
- Focus on UI/UX, user interactions, and presentation logic
- Keep backend and frontend completely separate

### React Patterns
- Use functional components with hooks exclusively (no class components)
- Keep components small and focused on single responsibilities
- Use proper React hooks: useState, useEffect, useContext, custom hooks
- State management primarily in App.jsx with props drilling or context
- Avoid complex prop drilling - consider lifting state when needed
- Follow React best practices for performance (memo, useCallback, useMemo when appropriate)
- Components handle their own loading and error states

### Multi-Tenant & Role-Based UI
- **Roles**: `platform_admin`, `business_owner`, `delegate`, `manager`, `viewer`
- Store role info in localStorage: `role`, `roles` (array), `acting_role`
- Platform admin sees all clients and manager management
- Business owner/delegate work within single tenant context
- Manager can switch between assigned clients via TenantSelector
- Show/hide UI elements based on user role and permissions
- Fetch user permissions via `getMyPermissions()` API call

### API Communication
- All backend calls go through centralized functions in `src/api.js`
- API_BASE switches between dev (http://localhost:3001/api) and production (/api)
- Handle loading states with local component state
- Display user-friendly error messages
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Include auth headers automatically via `getAuthHeaders()` helper
- Support custom headers: `Authorization`, `x-tenant-id`, `x-acting-role`
- Auto-retry 401 errors with token refresh in development
- Handle 204 No Content responses properly

### Routing & Navigation
- Routing logic currently embedded in App.jsx via `page` state
- Pages: 'login', 'signup', 'verify-email', main app views
- Use `view` state for in-app navigation (e.g., 'reports', 'admin', 'client')
- Handle URL parameters for verify-email and signup flows
- Implement protected routes - redirect to login when unauthorized
- Navigate between views by updating state, not full page reload

### State Management
- Primary state in App.jsx: reports, results, role, permissions, clients, etc.
- Use useState for local component state
- Use useEffect for side effects (data fetching, SSE subscriptions)
- Store auth tokens and role info in localStorage
- Keep authentication state (role, tenantId, actingRole) synchronized with localStorage
- Pass state and setters as props to child components

### Authentication & Security
- Token management handled by functions in `src/auth.js`
- Store JWT in localStorage as 'jwt' (or 'demo_jwt' for dev)
- Check token expiration before API calls
- Auto-logout on 401 responses from backend
- Clear all auth state (token, role, clientId, tenantId) on logout
- Email verification required before full access
- Support invitation-based signup via token in URL

### Real-Time Updates
- Server-Sent Events (SSE) via EventSource for live notifications
- AdminPanel subscribes to manager verification events
- ManagerRoutes subscribe to assignment update events
- Properly clean up EventSource connections in useEffect cleanup
- Auto-refresh data when SSE events received

### Component Organization
- Keep components in `src/components/`
- Use descriptive PascalCase component names (e.g., `AdminPanel.jsx`)
- Components receive data and callbacks via props
- Extract complex logic into separate functions within component files
- Custom hooks can be extracted to `src/hooks/` if reusable

### Styling
- **CSS Modules** (standard approach) - component-scoped styles using `.module.css` files
- Each component should have a corresponding CSS Module: `ComponentName.module.css`
- Import styles: `import styles from './ComponentName.module.css'`
- Apply classes: `<div className={styles.container}>`
- CSS Modules are automatically scoped by Vite (no class name conflicts)
- Use semantic class names (`.header`, `.button`, `.card`, not `.mt-4`, `.flex`)
- Leverage full CSS features: pseudo-classes (`:hover`, `:focus`, `:active`), media queries, animations
- Define CSS variables for consistent theming (colors, spacing, typography)
- Keep responsive design in mind - use media queries for different breakpoints
- Avoid inline styles except for truly dynamic values (e.g., calculated widths, user-chosen colors)
- Group related styles logically in CSS files
- Use consistent naming conventions (BEM or similar)

### File Naming & Structure
- Components: PascalCase (e.g., `UserProfile.jsx`)
- CSS Modules: PascalCase with `.module.css` extension (e.g., `UserProfile.module.css`)
- Utilities: camelCase (e.g., `api.js`, `auth.js`)
- Hooks: camelCase with "use" prefix (e.g., `useAuth.js`)
- All JavaScript files use .jsx or .js extensions (not .tsx/.ts)
- Co-locate component files with their styles in the same directory

## Development
- **Dev Server**: `npm run dev` (Vite dev server on port 3000)
- **Build**: `npm run build` (outputs to dist/)
- **Preview**: `npm run preview` (preview production build on port 3000)
- Vite HMR (Hot Module Replacement) for instant updates

## API Integration
- Backend runs on port 3001 in development
- Production: both frontend/backend served from same origin
- API_BASE automatically switches based on `import.meta.env.DEV`
- Handle CORS appropriately (backend configured to allow frontend)
- Include error handling for network failures and timeouts
- Show loading indicators during API calls
- Display meaningful error messages to users

## Important Notes
- This frontend communicates with a separate Node.js/Express backend
- All data operations performed via REST API calls - no direct database access
- Do not duplicate backend logic (validation, business rules, permissions) in frontend
- Frontend validates for UX only; backend is source of truth for security/validation
- Multi-tenant architecture: managers can switch between clients
- Keep frontend and backend code completely separate
- Focus on creating an excellent user experience with clear feedback and intuitive navigation
- Handle loading, error, and empty states gracefully
- Provide visual feedback for user actions (button states, success messages, etc.)
