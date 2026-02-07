from langchain_groq import ChatGroq
import os
from dotenv import load_dotenv
import json

load_dotenv()

class GeminiService:  # Keeping the class name for compatibility
    def __init__(self):
        print("=== Initializing Groq LLM ===")
        
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise Exception("GROQ_API_KEY not found in environment variables")
        
        try:
            self.llm = ChatGroq(
                temperature=0,
                groq_api_key=groq_api_key,
                model_name="llama-3.3-70b-versatile"
            )
            
            # Test if it works
            test_response = self.llm.invoke("Say 'OK' if you can hear me.")
            print(f"✓ Successfully initialized Groq with llama-3.3-70b-versatile")
            print(f"Test response: {test_response.content}")
        except Exception as e:
            print(f"✗ Failed to initialize Groq: {e}")
            raise Exception(f"Could not initialize Groq LLM. Check your API key: {e}")
        
        self.default_questions = [
            "Tell me about yourself and your background.",
            "What are your greatest strengths?",
            "Describe a challenging situation you faced and how you handled it.",
            "Where do you see yourself in five years?",
            "Why should we hire you?"
        ]
    
    def get_questions(self):
        """Get default SDE questions"""
        return self.default_questions
    
    def generate_questions_from_resume(self, resume_text):
        """Generate personalized questions based on resume"""
        prompt = f"""
Based on the following resume, generate 5 personalized interview questions that are relevant to the candidate's experience and skills.

Resume:
{resume_text}

Generate exactly 5 questions that:
1. Are specific to their experience
2. Probe their technical skills
3. Assess their problem-solving abilities
4. Evaluate their career progression
5. Test their domain knowledge

Return ONLY a JSON array of 5 questions, nothing else. Format:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
"""
        
        try:
            response = self.llm.invoke(prompt)
            questions_text = response.content.strip()
            
            # Remove markdown code fences if present
            questions_text = questions_text.replace("```json", "").replace("```", "").strip()
            
            questions = json.loads(questions_text)
            
            if isinstance(questions, list) and len(questions) == 5:
                return questions
            else:
                print("Invalid questions format, using defaults")
                return self.default_questions
                
        except Exception as e:
            print(f"Error generating questions from resume: {e}")
            return self.default_questions
    
    def generate_questions_for_role(self, role):
        """Generate questions for a specific role"""
        prompt = f"""
Generate 5 interview questions for a {role} position.

The questions should:
1. Be role-specific and relevant
2. Test technical knowledge
3. Assess problem-solving skills
4. Evaluate experience
5. Check cultural fit

Return ONLY a JSON array of 5 questions, nothing else. Format:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
"""
        
        try:
            response = self.llm.invoke(prompt)
            questions_text = response.content.strip()
            
            # Remove markdown code fences
            questions_text = questions_text.replace("```json", "").replace("```", "").strip()
            
            questions = json.loads(questions_text)
            
            if isinstance(questions, list) and len(questions) == 5:
                return questions
            else:
                return self.default_questions
                
        except Exception as e:
            print(f"Error generating questions for role: {e}")
            return self.default_questions
    
    def process_voice_command(self, command):
        """Process voice commands using Groq AI"""
        prompt = f"""
You are an AI interview assistant. The user said: "{command}"

Determine what action they want to take. Possible actions:
- "next" - move to next question
- "repeat" - repeat current question  
- "complete" - finish the interview
- "help" - need assistance
- "unknown" - didn't understand

Respond with ONLY a JSON object with this exact format:
{{"action": "next|repeat|complete|help|unknown", "message": "A friendly response to say to the user"}}

Be conversational and friendly. Keep messages under 20 words.
"""
        
        try:
            response = self.llm.invoke(prompt)
            result_text = response.content.strip()
            
            # Remove markdown
            result_text = result_text.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(result_text)
            
            return {
                "action": result.get("action", "unknown"),
                "message": result.get("message", "I didn't catch that. Please try again.")
            }
            
        except Exception as e:
            print(f"Error processing voice command: {e}")
            return {
                "action": "unknown",
                "message": "I didn't catch that. Please try again."
            }
    
    def generate_summary(self, responses):
        """Generate interview summary"""
        prompt = f"""
Analyze the following interview responses and provide a detailed assessment:

{responses}

Please provide:
1. A comprehensive summary of the candidate (3-4 sentences)
2. Top 3 strengths with examples
3. Top 3 areas for improvement
4. Communication quality score (1-10) with justification

Format your response as JSON with keys: summary, strengths (array), weaknesses (array), communication_score (number)
"""
        
        response = self.llm.invoke(prompt)
        return response.content