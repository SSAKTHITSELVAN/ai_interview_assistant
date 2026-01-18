import React, { useEffect, useRef, useState } from 'react';
import './Summary.css';

function Summary({ summary, setCurrentView }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    // Auto-speak summary when component mounts
    const timer = setTimeout(() => {
      speakSummary();
    }, 1000);

    return () => {
      clearTimeout(timer);
      synthRef.current.cancel();
    };
  }, []);

  const speakSummary = () => {
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(
      "Interview complete! " + summary
    );
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="summary-container">
      <div className="summary-card">
        <div className="success-header">
          <div className={`success-icon ${isSpeaking ? 'speaking' : ''}`}>✓</div>
          <h2>Interview Complete!</h2>
          <p>Here's your personalized feedback from AI analysis</p>
        </div>

        <div className="voice-controls-summary">
          {isSpeaking ? (
            <button onClick={stopSpeaking} className="btn-voice active">
              <span className="voice-icon">🔇</span>
              Stop Reading
            </button>
          ) : (
            <button onClick={speakSummary} className="btn-voice">
              <span className="voice-icon">🔊</span>
              Read Summary Aloud
            </button>
          )}
        </div>

        <div className="summary-content">
          <div className="summary-section">
            <h3>🤖 AI Analysis</h3>
            <div className="summary-text">
              <pre>{summary}</pre>
            </div>
          </div>

          <div className="tips-section">
            <h4>💡 What's Next?</h4>
            <ul>
              <li>Review your feedback carefully</li>
              <li>Practice areas that need improvement</li>
              <li>Take another interview to track progress</li>
              <li>Check your history to see growth over time</li>
            </ul>
          </div>
        </div>

        <div className="summary-actions">
          <button
            onClick={() => {
              stopSpeaking();
              setCurrentView('history');
            }}
            className="btn-primary"
          >
            📋 View All Interviews
          </button>
          <button
            onClick={() => {
              stopSpeaking();
              setCurrentView('home');
            }}
            className="btn-secondary"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Summary;