import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Quiz from './components/Quiz';
import Login from './components/Login';
import Register from './components/Register';
import Admin from './components/Admin';
import './styles/Quiz.css';

const NavBar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="nav-bar">
      <ul>
        <li>
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
          >
            Quiz
          </Link>
        </li>
        {!isAuthenticated ? (
          <>
            <li>
              <Link 
                to="/login" 
                className={location.pathname === '/login' ? 'active' : ''}
              >
                Login
              </Link>
            </li>
            <li>
              <Link 
                to="/register" 
                className={location.pathname === '/register' ? 'active' : ''}
              >
                Register
              </Link>
            </li>
          </>
        ) : (
          <>
            {user?.isAdmin && (
              <li>
                <Link 
                  to="/admin" 
                  className={location.pathname === '/admin' ? 'active' : ''}
                >
                  Admin
                </Link>
              </li>
            )}
            <li>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

const PrivateRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? element : <Navigate to="/login" />;
};

const AdminRoute: React.FC<{ element: React.ReactElement }> = ({ element }) => {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated && user?.isAdmin ? element : <Navigate to="/" />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <NavBar />
          <div className="content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/admin"
                element={<AdminRoute element={<Admin />} />}
              />
              <Route
                path="/"
                element={<PrivateRoute element={<Quiz />} />}
              />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App; 