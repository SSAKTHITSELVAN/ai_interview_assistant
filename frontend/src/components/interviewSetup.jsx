import React, { useState, useRef } from 'react';
import './InterviewSetup.css';

const API_URL = 'http://localhost:8000/api';

function InterviewSetup({ token, onStart }) {
  const [mode, setMode] = useState(null);
  const [role, setRole] = useState('');
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      setError('Please upload a PDF or TXT file');
      return;
    }

    setResume(file);
    setError('');
  };

  const startInterview = async () => {
    setLoading(true);
    setError('');

    try {
      let questions = null;
      let resumeText = null;

      // Handle resume upload
      if (mode === 'resume') {
        if (!resume) {
          setError('Please upload a resume');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', resume);

        const uploadResponse = await fetch(`${API_URL}/interview/upload-resume`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload resume');
        }

        const uploadData = await uploadResponse.json();
        questions = uploadData.questions;
        resumeText = uploadData.resume_text;
      }

      // Start interview with selected mode
      const startData = {
        mode: mode || 'default',
        role: mode === 'custom' ? role : null,
        resume_text: resumeText
      };

      const response = await fetch(`${API_URL}/interview/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(startData)
      });

      if (!response.ok) {
        throw new Error('Failed to start interview');
      }

      const data = await response.json();
      
      // Pass interview data to parent
      onStart({
        interviewId: data.interview_id,
        questions: data.questions
      });

    } catch (err) {
      console.error('Error starting interview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="setup-container">
        <div className="setup-card">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Setting up your interview...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <div className="setup-card">
        <div className="setup-header">
          <h2>🎤 Choose Interview Mode</h2>
          <p>Select how you'd like to customize your interview</p>
        </div>

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        <div className="mode-selection">
          {/* Resume Upload Mode */}
          <div 
            className={`mode-card ${mode === 'resume' ? 'selected' : ''}`}
            onClick={() => setMode('resume')}
          >
            <div className="mode-icon">📄</div>
            <h3>Upload Resume</h3>
            <p>AI generates questions based on your experience</p>
            
            {mode === 'resume' && (
              <div className="mode-input" onClick={(e) => e.stopPropagation()}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleResumeUpload}
                  accept=".pdf,.txt"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="upload-btn"
                >
                  {resume ? `✓ ${resume.name}` : '📎 Choose File (PDF/TXT)'}
                </button>
              </div>
            )}
          </div>

          {/* Custom Role Mode */}
          <div 
            className={`mode-card ${mode === 'custom' ? 'selected' : ''}`}
            onClick={() => setMode('custom')}
          >
            <div className="mode-icon">💼</div>
            <h3>Custom Role</h3>
            <p>Enter the role you're applying for</p>
            
            {mode === 'custom' && (
              <div className="mode-input" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g., Frontend Developer, Data Scientist"
                  className="role-input"
                />
              </div>
            )}
          </div>

          {/* Default SDE Mode */}
          <div 
            className={`mode-card ${mode === 'default' ? 'selected' : ''}`}
            onClick={() => setMode('default')}
          >
            <div className="mode-icon">⚡</div>
            <h3>Default (SDE)</h3>
            <p>Standard Software Developer questions</p>
          </div>
        </div>

        <div className="setup-actions">
          <button
            onClick={startInterview}
            disabled={!mode || (mode === 'resume' && !resume) || (mode === 'custom' && !role.trim())}
            className="btn-start"
          >
            🎙️ Start Voice Interview
          </button>
        </div>

        <div className="setup-info">
          <p>💡 <strong>Tip:</strong> Make sure your microphone is working and you're in a quiet environment</p>
        </div>
      </div>
    </div>
  );
}

export default InterviewSetup;