import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import InterviewSetup from './components/InterviewSetup';
import Interview from './components/Interview';
import History from './components/History';
import './App.css';

function App() {
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [interviewData, setInterviewData] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      setCurrentView('home');
    }
  }, []);

  const handleSetToken = (newToken) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentView('login');
    setInterviewData(null);
  };

  const handleStartInterview = (data) => {
    setInterviewData(data);
    setCurrentView('interview');
  };

  if (!token || currentView === 'login') {
    return <Login setToken={handleSetToken} setCurrentView={setCurrentView} />;
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">
            <h1>AI Interview</h1>
            <span className="nav-subtitle">Powered by Gemini</span>
          </div>
          <div className="nav-links">
            <button
              onClick={() => {
                setCurrentView('home');
                setInterviewData(null);
              }}
              className={`nav-link ${currentView === 'home' ? 'active' : ''}`}
            >
              🏠 Home
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`nav-link ${currentView === 'history' ? 'active' : ''}`}
            >
              📋 History
            </button>
            <button onClick={logout} className="nav-link logout-btn">
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {currentView === 'home' && <HomeScreen setCurrentView={setCurrentView} />}
        {currentView === 'setup' && (
          <InterviewSetup token={token} onStart={handleStartInterview} />
        )}
        {currentView === 'interview' && interviewData && (
          <Interview
            token={token}
            interviewId={interviewData.interviewId}
            questions={interviewData.questions}
            setCurrentView={setCurrentView}
          />
        )}
        {currentView === 'history' && <History token={token} />}
      </main>
    </div>
  );
}

function HomeScreen({ setCurrentView }) {
  return (
    <div className="home-container">
      <div className="home-card">
        <div className="home-icon">🎤</div>
        <h2>Ready for Your Voice Interview?</h2>
        <p className="home-description">
          Experience a completely hands-free, AI-powered interview.
          Just speak naturally - no buttons, no typing!
        </p>

        <button
          onClick={() => setCurrentView('setup')}
          className="btn-start-interview"
        >
          🚀 Setup Interview
        </button>

        <div className="feature-grid">
          <div className="feature-item">
            <div className="feature-number">🎙️</div>
            <div className="feature-label">Voice Only</div>
          </div>
          <div className="feature-item">
            <div className="feature-number">🤖</div>
            <div className="feature-label">AI Powered</div>
          </div>
          <div className="feature-item">
            <div className="feature-number">📊</div>
            <div className="feature-label">Instant Feedback</div>
          </div>
        </div>

        <div className="info-section">
          <h3>How It Works:</h3>
          <ul className="benefits-list">
            <li>✓ Choose your interview mode (Resume, Role, or Default)</li>
            <li>✓ AI asks questions - you answer by speaking</li>
            <li>✓ Use voice commands like "next question"</li>
            <li>✓ Get comprehensive feedback at the end</li>
          </ul>
        </div>

        <div className="voice-commands-preview">
          <h4>🎤 Voice Commands You'll Use:</h4>
          <div className="commands-grid">
            <div className="command-box">"Next question"</div>
            <div className="command-box">"Repeat"</div>
            <div className="command-box">"Complete interview"</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;