from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import json
import PyPDF2
import io

from .database import engine, get_db, Base
from .models import User, Interview, Response
from .auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)
from .gemini_service import GeminiService

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Interview API")

# CORS - Allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

gemini_service = GeminiService()

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class ResponseCreate(BaseModel):
    question: str
    answer: str

class InterviewStart(BaseModel):
    mode: str  # "resume", "custom", "default"
    role: Optional[str] = None
    resume_text: Optional[str] = None

class VoiceCommand(BaseModel):
    command: str
    interview_id: int

class AIResponseRequest(BaseModel):
    question: str
    answer: str
    question_number: int
    total_questions: int

# Routes
@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    print(f"Registration attempt for username: {user.username}")
    
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    print(f"User created with ID: {db_user.id}")
    
    access_token = create_access_token(data={"sub": str(db_user.id)})
    print(f"Token created for user ID: {db_user.id}")
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    print(f"Login attempt for username: {user.username}")
    
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        print("Invalid credentials")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    print(f"User authenticated: {db_user.username}, ID: {db_user.id}")
    
    access_token = create_access_token(data={"sub": str(db_user.id)})
    print(f"Token created for user ID: {db_user.id}")
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/interview/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    print(f"Resume upload by user: {current_user.username}")
    
    try:
        content = await file.read()
        
        # Extract text from PDF
        if file.filename.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            resume_text = ""
            for page in pdf_reader.pages:
                resume_text += page.extract_text()
        else:
            # For text files
            resume_text = content.decode('utf-8')
        
        print(f"Resume text extracted: {len(resume_text)} characters")
        
        # Generate questions based on resume
        questions = gemini_service.generate_questions_from_resume(resume_text)
        
        return {"questions": questions, "resume_text": resume_text}
    
    except Exception as e:
        print(f"Error processing resume: {e}")
        raise HTTPException(status_code=400, detail=f"Error processing resume: {str(e)}")

@app.post("/api/interview/generate-questions")
def generate_questions(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    print(f"Generate questions for user: {current_user.username}")
    mode = data.get("mode", "default")
    
    if mode == "resume":
        resume_text = data.get("resume_text", "")
        questions = gemini_service.generate_questions_from_resume(resume_text)
    elif mode == "custom":
        role = data.get("role", "Software Developer")
        questions = gemini_service.generate_questions_for_role(role)
    else:
        questions = gemini_service.get_questions()
    
    return {"questions": questions}

@app.get("/api/interview/questions")
def get_questions(current_user: User = Depends(get_current_user)):
    print(f"Questions requested by user: {current_user.username}")
    return {"questions": gemini_service.get_questions()}

@app.post("/api/interview/start")
def start_interview(
    data: InterviewStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"Starting interview for user: {current_user.username}, mode: {data.mode}")
    
    interview = Interview(user_id=current_user.id)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    
    # Generate questions based on mode
    if data.mode == "resume" and data.resume_text:
        questions = gemini_service.generate_questions_from_resume(data.resume_text)
    elif data.mode == "custom" and data.role:
        questions = gemini_service.generate_questions_for_role(data.role)
    else:
        questions = gemini_service.get_questions()
    
    print(f"Interview created with ID: {interview.id}")
    return {"interview_id": interview.id, "questions": questions}

@app.post("/api/interview/generate-ai-response")
def generate_ai_response(
    data: AIResponseRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate conversational AI response to candidate's answer"""
    print(f"Generating AI response for user: {current_user.username}")
    print(f"Question {data.question_number}/{data.total_questions}: {data.question[:50]}...")
    print(f"Candidate answer: {data.answer[:100]}...")
    
    try:
        # Create a conversational prompt
        prompt = f"""You are an experienced job interviewer conducting a professional interview. 

Current Question ({data.question_number} of {data.total_questions}): "{data.question}"

Candidate's Answer: "{data.answer}"

Your task:
1. Respond naturally and professionally as an interviewer would
2. Acknowledge their answer briefly (1-2 sentences)
3. Decide if you need a follow-up question OR if the answer is complete
4. If complete and satisfactory, say something like "Great answer! Let's move to the next question."
5. If you need clarification or more detail, ask ONE brief follow-up question
6. Keep your ENTIRE response under 40 words
7. Be encouraging and professional

Respond ONLY with what you would say out loud. No formatting, no explanations, no asterisks."""

        response = gemini_service.model.generate_content(prompt)
        ai_response = response.text.strip()
        
        # Clean up any unwanted formatting
        ai_response = ai_response.replace('*', '').replace('#', '').replace('**', '').strip()
        
        # Remove any markdown or code blocks
        if '```' in ai_response:
            ai_response = ai_response.split('```')[0].strip()
        
        print(f"AI Response: {ai_response}")
        
        return {"response": ai_response}
        
    except Exception as e:
        print(f"Error generating AI response: {e}")
        # Fallback response
        return {
            "response": "Thank you for sharing that. Would you like to add anything else, or shall we move to the next question?"
        }

@app.post("/api/interview/process-voice-command")
def process_voice_command(
    data: VoiceCommand,
    current_user: User = Depends(get_current_user)
):
    """Process voice commands like 'next question', 'repeat', 'complete'"""
    command = data.command.lower()
    
    print(f"Voice command: {command}")
    
    # Use Gemini to understand the command
    response = gemini_service.process_voice_command(command)
    
    return {"action": response["action"], "message": response["message"]}

@app.post("/api/interview/{interview_id}/response")
def save_response(
    interview_id: int,
    response: ResponseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"Saving response for interview {interview_id}, user: {current_user.username}")
    
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    db_response = Response(
        interview_id=interview_id,
        question=response.question,
        answer=response.answer
    )
    db.add(db_response)
    db.commit()
    
    print(f"Response saved for interview {interview_id}")
    return {"status": "success"}

@app.post("/api/interview/{interview_id}/complete")
def complete_interview(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"Completing interview {interview_id} for user: {current_user.username}")
    
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    # Get all responses
    responses = db.query(Response).filter(Response.interview_id == interview_id).all()
    responses_text = "\n\n".join([f"Q: {r.question}\nA: {r.answer}" for r in responses])
    
    print(f"Generating summary for interview {interview_id}")
    
    # Generate summary using Gemini
    try:
        summary_text = gemini_service.generate_summary(responses_text)
        
        try:
            clean_text = summary_text.replace("```json", "").replace("```", "").strip()
            summary_data = json.loads(clean_text)
            
            interview.summary = summary_data.get("summary", "")
            interview.strengths = json.dumps(summary_data.get("strengths", []))
            interview.weaknesses = json.dumps(summary_data.get("weaknesses", []))
            interview.communication_score = summary_data.get("communication_score", 5)
        except json.JSONDecodeError:
            print("Could not parse summary as JSON, using raw text")
            interview.summary = summary_text
            interview.communication_score = 7
    except Exception as e:
        print(f"Error generating summary: {e}")
        interview.summary = "Summary generation failed. Please try again."
        interview.communication_score = 5
    
    interview.completed_at = datetime.utcnow()
    db.commit()
    
    print(f"Interview {interview_id} completed successfully")
    return {"status": "success", "summary": interview.summary}

@app.get("/api/interview/history")
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    print(f"Fetching history for user: {current_user.username}")
    
    interviews = db.query(Interview).filter(
        Interview.user_id == current_user.id,
        Interview.completed_at.isnot(None)
    ).order_by(Interview.completed_at.desc()).all()
    
    return {"interviews": [
        {
            "id": i.id,
            "completed_at": i.completed_at.isoformat() if i.completed_at else None,
            "summary": i.summary,
            "strengths": i.strengths,
            "weaknesses": i.weaknesses,
            "communication_score": i.communication_score
        }
        for i in interviews
    ]}

@app.get("/api/interview/{interview_id}")
def get_interview(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print(f"Fetching interview {interview_id} for user: {current_user.username}")
    
    interview = db.query(Interview).filter(
        Interview.id == interview_id,
        Interview.user_id == current_user.id
    ).first()
    
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    
    responses = db.query(Response).filter(Response.interview_id == interview_id).all()
    
    return {
        "interview": {
            "id": interview.id,
            "completed_at": interview.completed_at.isoformat() if interview.completed_at else None,
            "summary": interview.summary,
            "strengths": interview.strengths,
            "weaknesses": interview.weaknesses,
            "communication_score": interview.communication_score
        },
        "responses": [
            {"question": r.question, "answer": r.answer}
            for r in responses
        ]
    }

@app.get("/")
def root():
    return {"message": "AI Interview API is running"}