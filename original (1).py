import cv2
import cvzone
import requests
import torch
from ultralytics import YOLO
from deep_sort_realtime.deepsort_tracker import DeepSort
import math
import numpy as np
import matplotlib.pyplot as plt 
from tensorflow.keras.models import load_model 
from database import supabase
import os

cv2.namedWindow('Drowsiness Detector', cv2.WINDOW_NORMAL)




class DrowsinessDetector:
    def __init__(self, yolov8_model_path, vgg16_model_path, video_source="https://aslrmiysodplkbyznmnf.supabase.co/storage/v1/object/public/videos/0.7983982306679558.mp4", deepsort_max_age=30, deepsort_n_init=3, deepsort_nn_budget=100):
        self._initialize_yolo(yolov8_model_path)
        self._initialize_deepsort(deepsort_max_age, deepsort_n_init, deepsort_nn_budget)
        self._initialize_vgg16(vgg16_model_path)
        video_source = self.fetch_video_from_supabase()
        self._initialize_video(video_source)
        self.attentive_frames = {}  # Dictionary to store attentive frames for each tracker ID
        self.track_photos = {}  # Dictionary to store a photo of each unique track ID
        self.total_frames = 0

    def fetch_video_from_supabase(self):
        try:
            response = supabase.table("video_analysis").select("video_url").limit(1).execute()
            if response and response.data:
                video_url = response.data[0]['video_url']
                local_video_path = "downloaded_video.mp4"
                
                # Download the video file
                with requests.get(video_url, stream=True) as r:
                    r.raise_for_status()
                    with open(local_video_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                return local_video_path
            else:
                raise ValueError("No video URL found in video_analysis table.")
        except Exception as e:
            print(f"Error fetching video from Supabase: {e}")
            return "https://aslrmiysodplkbyznmnf.supabase.co/storage/v1/object/public/videos/0.7983982306679558.mp4"
        


    def _initialize_yolo(self, yolov8_model_path):
        self.yolov8_model = YOLO(yolov8_model_path)

    def _initialize_deepsort(self, max_age, n_init, nn_budget):
        self.tracker = DeepSort(max_age=max_age, n_init=n_init, nn_budget=nn_budget, embedder="mobilenet")

    def _initialize_vgg16(self, vgg16_model_path):
        self.vgg16_model = load_model(vgg16_model_path)

    def _initialize_video(self, video_source):
        self.cap = cv2.VideoCapture(video_source)
        if not self.cap.isOpened():
            raise ValueError("Error: Cannot open video source")

        self.fourcc = cv2.VideoWriter_fourcc(*'XVID')
        self.out = cv2.VideoWriter('output.avi', self.fourcc, 20.0, 
                                   (int(self.cap.get(3)), int(self.cap.get(4))))

    def detect_objects(self, frame):
        results = self.yolov8_model(frame, stream=True, classes=[0])  # Only detect persons (class 0)
        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0]
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                confidence = math.ceil((box.conf[0] * 100)) / 100
                
                # Convert (x1, y1, x2, y2) -> (x_center, y_center, w, h)
                x_center = (x1 + x2) / 2
                y_center = (y1 + y2) / 2
                width = x2 - x1
                height = y2 - y1
                
                detections.append(([x_center, y_center, width, height], confidence))
        return detections
    

    def update_tracks(self, frame, detections):
        return self.tracker.update_tracks(detections, frame=frame)

    def preprocess_image(self, img):
        resized_img = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)
        return np.expand_dims(resized_img, axis=0)

    def predict_attention(self, img):
        preprocessed_img = self.preprocess_image(img)
        predicted_out = self.vgg16_model.predict(preprocessed_img)
        attentive_class = predicted_out[0][9]  # Assuming index 9 is for 'attentive'
        return "attentive" if attentive_class > 0.5 else "non-attentive"


    def upload_image_to_supabase(self, track_id, img):
        """Uploads image to Supabase Storage and returns public URL."""
        save_path = f"tracked_photos/student_{track_id}.jpg"
        os.makedirs("tracked_photos", exist_ok=True)
        cv2.imwrite(save_path, img)
        
        with open(save_path, "rb") as f:
            image_data = f.read()

        response = supabase.storage.from_("student_images").upload(f"student_{track_id}.jpg", image_data, {"content-type": "image/jpeg"})
        print(f"Uploaded image to Supabase: {response}")
        
        return f"https://aslrmiysodplkbyznmnf.supabase.co/storage/v1/object/public/student_images/student_{track_id}.jpg"
    

    def verify_table_access(self):
        """Verify table access before operations"""
        try:
            # Test query
            supabase.table("students").select("st_id").limit(1).execute()
            return True
        except Exception as e:
            print(f"Table access verification failed: {e}")
            return False
    
    
    def calculate_attention_percentage(self, attentive_count):
        """Calculates the attention percentage with a safety check for zero division."""
        
        # Define the threshold for frame consideration (e.g., 75% of total frames)
        threshold_factor = 0.75  

        # Ensure there are enough frames to calculate attention
        effective_frames = self.total_frames * (1 - threshold_factor)
        if effective_frames <= 0:  # Prevent division by zero
            return 0  

        # Calculate percentage and round to 2 decimal places
        attention_percentage = (attentive_count / effective_frames) * 100
        return round(attention_percentage, 2)  # Ensure only 2 decimal places


    def get_next_student_number(self):
        """Fetches the highest student number from Supabase and returns the next available number."""
        try:
            response = supabase.storage.from_("student_images").list()
            existing_files = [file['name'] for file in response] if response else []

            student_numbers = []
            for filename in existing_files:
                if filename.startswith("student_") and filename.endswith(".jpg"):
                    num_part = filename.replace("student_", "").replace(".jpg", "")
                    if num_part.isdigit():
                        student_numbers.append(int(num_part))

            next_number = max(student_numbers) + 1 if student_numbers else 1  # Start from 1 if empty
            return next_number

        except Exception as e:
            print(f"Error fetching student numbers: {e}")
            return 1  # Fallback to 1 if error

    def save_to_database(self):
        """Sort student id in attentive_frames"""
        self.attentive_frames = dict(sorted(self.attentive_frames.items()))
        
        """Saves student ID, image URL, and attention percentage to Supabase."""
        
        if not self.verify_table_access():
            print("Cannot access students table. Check permissions.")
            return
        
        try:
            next_student_number = self.get_next_student_number()  # Fetch the next available number

            for track_id, attentive_count in self.attentive_frames.items():
                attention_percentage = self.calculate_attention_percentage(attentive_count)
                if track_id in self.track_photos:
                    student_filename = f"{next_student_number}"  # Ensure sequential numbering
                    image_url = self.upload_image_to_supabase(student_filename, self.track_photos[track_id])

                    if image_url:
                        student_id = next_student_number
                        data = {
                            "st_id": student_id,
                            "image": image_url,
                            "attention_percentage": attention_percentage
                        }
                        response = supabase.table("students").insert(data).execute()
                        print(f"Saved to database: {data}")
                        next_student_number += 1  # Increment for the next student
        except Exception as e:
            print(f"Error saving to database: {e}")



    def process_frame(self, frame):
        detections = self.detect_objects(frame)
        print("DETECTIONS:", detections)
        tracks = self.update_tracks(frame, detections)

        for track in tracks:
            if not track.is_confirmed() or track.time_since_update > 1:
                continue

            bbox = track.to_tlwh()  # Get bounding box in (x, y, w, h) format
            print("BBOX:", bbox)
            
            track_id = track.track_id
            x_center, y_center, w, h = map(int, bbox)
            
            # Convert (x_center, y_center, w, h) -> (x1, y1, x2, y2)
            x1 = x_center - (w // 2)
            y1 = y_center - (h // 2)
            x2 = x_center + (w // 2)
            y2 = y_center + (h // 2)
            
            person_img = frame[y1:y2, x1:x2]
            if person_img.size > 0:
                prediction = self.predict_attention(person_img)
                
                if prediction == "attentive":
                    if track_id not in self.attentive_frames:
                        self.attentive_frames[track_id] = 0
                        self.track_photos[track_id] = person_img  # Store the first frame as the photo
                    self.attentive_frames[track_id] += 1
                
                # cvzone.cornerRect(frame, (x1, y1, x2 - x1, y2 - y1))
                # cv2.putText(frame, f'ID: {track_id} {prediction}', (x1, y1 - 10), 
                #             cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)            
        return frame
    
    
    def calculate_classroom_performance(self):
        total_students = len(self.attentive_frames)
        if total_students == 0:
            print("No students detected.")
            return

        print("\nClassroom Performance Summary:")
        classroom_attention_sum = 0

        for track_id, attentive_count in self.attentive_frames.items():
            attention_percentage = self.calculate_attention_percentage(attentive_count)
            classroom_attention_sum += attention_percentage

            self.llmdict[track_id] = attention_percentage
            
            print(f"Student ID: {track_id}")
            print(f"  Attention Percentage: {attention_percentage:.2f}%")

        # Calculate the average attention percentage for the classroom
        classroom_average_attention = round(classroom_attention_sum / total_students,2)
        print(f"\nClassroom Average Attention: {classroom_average_attention:.2f}%")
        self.llmdict["Classroom Average Attention"] = classroom_average_attention


        # Classify classroom engagement
        if classroom_average_attention >= 80:
            print("Classroom Engagement: Highly Engaged")
        elif classroom_average_attention >= 50:
            print("Classroom Engagement: Moderately Engaged")
        else:
            print("Classroom Engagement: Low Engagement")
        
        

    def detect_and_track(self):
        frame_counter = 0
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break
            self.total_frames += 1
            frame_counter += 1

            # Skip 4 frames, process every 5th frame
            if frame_counter % 5 != 0:
                continue

            processed_frame = self.process_frame(frame)
            self.out.write(processed_frame)
            cv2.imshow('Drowsiness Detector', processed_frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
        self.save_to_database()
        self.calculate_classroom_performance()
        


    def release_resources(self):
        self.cap.release()
        self.out.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    detector = DrowsinessDetector(yolov8_model_path='yolov8l.pt', vgg16_model_path='Student_attentive_25epsv2.h5')
    detector.detect_and_track()
    detector.release_resources() 