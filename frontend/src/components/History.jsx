import React, { useState, useEffect } from 'react';
import './History.css';

const API_URL = 'http://localhost:8000/api';

function History({ token }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [interviewDetails, setInterviewDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchHistory();
    }
  }, [token]);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/interview/history`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setInterviews(data.interviews || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to load interview history');
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewDetails = async (interviewId) => {
    try {
      const response = await fetch(`${API_URL}/interview/${interviewId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch interview details');
      }

      const data = await response.json();
      setInterviewDetails(data);
      setSelectedInterview(interviewId);
    } catch (err) {
      console.error('Error fetching interview details:', err);
      alert('Failed to load interview details');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your interview history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h2>Error Loading History</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (interviews.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h2>No Interview History</h2>
        <p>You haven't completed any interviews yet. Start your first interview to see results here!</p>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Interview History</h2>
        <p>Review your past interviews and track your progress</p>
      </div>

      <div className="history-content">
        <div className="interviews-list">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className={`interview-item ${selectedInterview === interview.id ? 'active' : ''}`}
              onClick={() => fetchInterviewDetails(interview.id)}
            >
              <div className="interview-header">
                <span className="interview-date">
                  {formatDate(interview.completed_at)}
                </span>
                {interview.communication_score && (
                  <span className="score-badge">
                    Score: {interview.communication_score}/10
                  </span>
                )}
              </div>
              <p className="interview-summary-preview">
                {interview.summary ? interview.summary.substring(0, 100) + '...' : 'View details'}
              </p>
            </div>
          ))}
        </div>

        {selectedInterview && interviewDetails && (
          <div className="interview-details">
            <div className="details-header">
              <h3>Interview Details</h3>
              <span className="detail-date">
                {formatDate(interviewDetails.interview.completed_at)}
              </span>
            </div>

            <div className="score-section">
              <div className="score-card">
                <span className="score-label">Communication Score</span>
                <span className="score-value">
                  {interviewDetails.interview.communication_score || 'N/A'}/10
                </span>
              </div>
            </div>

            <div className="detail-section">
              <h4>Summary</h4>
              <p className="detail-text">
                {interviewDetails.interview.summary || 'No summary available'}
              </p>
            </div>

            {interviewDetails.interview.strengths && (
              <div className="detail-section">
                <h4>Strengths</h4>
                <ul className="strengths-list">
                  {parseJSON(interviewDetails.interview.strengths).map((strength, index) => (
                    <li key={index}>✓ {strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {interviewDetails.interview.weaknesses && (
              <div className="detail-section">
                <h4>Areas for Improvement</h4>
                <ul className="weaknesses-list">
                  {parseJSON(interviewDetails.interview.weaknesses).map((weakness, index) => (
                    <li key={index}>→ {weakness}</li>
                  ))}
                </ul>
              </div>
            )}

            {interviewDetails.responses && interviewDetails.responses.length > 0 && (
              <div className="detail-section">
                <h4>Your Responses</h4>
                {interviewDetails.responses.map((response, index) => (
                  <div key={index} className="response-item">
                    <p className="response-question"><strong>Q{index + 1}:</strong> {response.question}</p>
                    <p className="response-answer"><strong>A:</strong> {response.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default History;