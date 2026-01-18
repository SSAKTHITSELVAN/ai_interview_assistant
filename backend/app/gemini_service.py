import google.generativeai as genai
import os
from dotenv import load_dotenv
import json

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class GeminiService:
    def __init__(self):
        # List available models and print them for debugging
        print("=== Available Gemini Models ===")
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    print(f"Model: {m.name}")
        except Exception as e:
            print(f"Could not list models: {e}")
        print("================================")
        
        # Updated list to try the NEW models that are actually available
        model_names_to_try = [
            'models/gemini-2.5-flash',  # Newest and fastest
            'models/gemini-2.5-pro',    # Most capable
            'models/gemini-2.0-flash',  # Alternative
            'models/gemini-flash-latest',  # Generic latest
            'models/gemini-pro-latest',    # Generic latest pro
            'gemini-2.5-flash',
            'gemini-2.0-flash',
        ]
        
        self.model = None
        for model_name in model_names_to_try:
            try:
                print(f"Trying model: {model_name}")
                self.model = genai.GenerativeModel(model_name)
                # Test if it works
                test_response = self.model.generate_content("Say 'OK' if you can hear me.")
                print(f"✓ Successfully initialized with model: {model_name}")
                break
            except Exception as e:
                print(f"✗ Failed with {model_name}: {e}")
                continue
        
        if self.model is None:
            raise Exception("Could not initialize any Gemini model. Check your API key and model availability.")
        
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
            response = self.model.generate_content(prompt)
            questions_text = response.text.strip()
            
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
            response = self.model.generate_content(prompt)
            questions_text = response.text.strip()
            
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
        """Process voice commands using Gemini AI"""
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
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
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
        
        response = self.model.generate_content(prompt)
        return response.text