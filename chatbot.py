import google.generativeai as genai
from tensorflow.python.keras.constraints import nonneg

from database import supabase
from datetime import datetime


class ChatBot:
    def __init__(self, llmdict, first_student_number):
        self.llmdict = llmdict
        self.api_key = "AIzaSyD_Jn-NVaPZ4uAOzEgvUc2q08DFLnqwEIk"  # Replace with your actual API key
        self.first_student_number = first_student_number


    def load_gemini_model(self):
        genai.configure(api_key=self.api_key)
        return genai.GenerativeModel("gemini-1.5-pro-latest")


    def generate_response(self, model, prompt_main, performance_data):
        input_text = f"{prompt_main}\n{performance_data}\nChatbot:"

        try:
            # Generate content

            response = model.generate_content(
                contents=input_text,
                generation_config=genai.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=500,
                    top_p=0.95,
                    top_k=40
                )
            )
            chatbot_reply = response.text.strip()
        except Exception as e:
            chatbot_reply = "Sorry, I encountered an error. Please try again later."

        return chatbot_reply


    def chat(self):
        model = self.load_gemini_model()
        prompt_main = "You are an educational chatbot analyzing student engagement and providing improvement recommendations by analyzing each student and the overall class attention percentage."
        response = self.generate_response(model, prompt_main, str(self.llmdict))
        print(f"Chatbot: {response}\n")

        # Save the response to Supabase
        self.save_to_database(response)


    def save_to_database(self, chatbot_reply):
        try:
            data = {
                "chatbot_response": chatbot_reply
            }

            res = supabase.table("students").update(data).eq("st_id", self.first_student_number).execute()

            if res.data:
                print("Response saved to database successfully!")
            else:
                print("Failed to update response in database.")
        except Exception as e:
            print(f"Error saving to database: {e}")



if __name__ == "__main__":
    # gemini = ChatBot(llmdict=None, first_student_number=10)
    # gemini.save_to_database("HI")
    save_to_database("HI")