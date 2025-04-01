export interface VideoAnalysis {
  id: number;
  created_at: string;
  video_url: string;
  video_title: string;
  status: string;
}

export interface Student {
  st_id: string;
  created_at: string;
  attention_percentage: number;
  image: string | null;
  video_title?: string;
  chatbot_response?: string | null;
}
