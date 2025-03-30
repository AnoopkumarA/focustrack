import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import Navbar from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

const NewAnalysis = () => {
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [recentAnalysis, setRecentAnalysis] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [averageAttention, setAverageAttention] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const fetchRecentAnalysis = async () => {
    try {
      // First, fetch video analysis data
      const { data: videoData, error: videoError } = await supabase
        .from('video_analysis')
        .select('video_title, video_url')
        .order('created_at', { ascending: false })
        .limit(1);

      if (videoError) throw videoError;

      // Then fetch all results ordered by time
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('st_id, image, attention_percentage, created_at')
        .order('created_at', { ascending: false });

      if (studentsError) throw studentsError;
      
      if (studentsData && studentsData.length > 0) {
        // Get the most recent timestamp in HH:mm format
        const mostRecentTime = new Date(studentsData[0].created_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });

        // Filter to get all results that match the most recent time
        const latestResults = studentsData.filter(record => {
          const recordTime = new Date(record.created_at).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
          return recordTime === mostRecentTime;
        });

        // Calculate average attention percentage
        const totalAttention = latestResults.reduce((sum, result) => 
          sum + (result.attention_percentage || 0), 0);
        const avgAttention = latestResults.length > 0 
          ? totalAttention / latestResults.length 
          : 0;
        
        setAverageAttention(avgAttention);
        setRecentAnalysis(latestResults.map(result => ({
          ...result,
          video_title: videoData?.[0]?.video_title || 'Untitled Video'
        })));
      } else {
        setRecentAnalysis([]);
        setAverageAttention(null);
      }
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error fetching recent analysis:', error);
      setIsProcessing(false);
      setAverageAttention(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setIsProcessing(true);
      setCountdown(300);

      // Clear any existing timeout
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        setProcessingTimeout(null);
      }

      // First, get the current video if any exists
      const { data: existingVideos } = await supabase
        .from('video_analysis')
        .select('video_url')
        .limit(1);

      if (existingVideos && existingVideos.length > 0) {
        const oldVideoUrl = existingVideos[0].video_url;
        const oldFileName = oldVideoUrl.split('/').pop();
        
        if (oldFileName) {
          await supabase.storage
            .from('videos')
            .remove([oldFileName]);

          await supabase
            .from('video_analysis')
            .delete()
            .match({ video_url: oldVideoUrl });
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (storageError) throw storageError;

      const { data: publicURL } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('video_analysis')
        .insert([{ 
          video_url: publicURL.publicUrl,
          video_title: file.name,
          status: 'processing'
        }]);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Video uploaded successfully! Processing will take 3 minutes...",
      });

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set timeout to fetch results after 300 seconds
      const timeout = setTimeout(() => {
        fetchRecentAnalysis();
        clearInterval(countdownInterval);
      }, 300000);
      
      setProcessingTimeout(timeout);

    } catch (error: any) {
      console.error('Error uploading video:', error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error uploading video",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      setUploading(true);
      setIsProcessing(true);
      setCountdown(300);
      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Clear any existing timeout
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        setProcessingTimeout(null);
      }

      // First, get the current video if any exists
      const { data: existingVideos } = await supabase
        .from('video_analysis')
        .select('video_url')
        .limit(1);

      if (existingVideos && existingVideos.length > 0) {
        const oldVideoUrl = existingVideos[0].video_url;
        const oldFileName = oldVideoUrl.split('/').pop();
        
        if (oldFileName) {
          await supabase.storage
            .from('videos')
            .remove([oldFileName]);

          await supabase
            .from('video_analysis')
            .delete()
            .match({ video_url: oldVideoUrl });
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (storageError) throw storageError;

      const { data: publicURL } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('video_analysis')
        .insert([{ 
          video_url: publicURL.publicUrl,
          video_title: file.name,
          status: 'processing'
        }]);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Video uploaded successfully! Processing will take 5 minutes...",
      });

      // Start countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Set timeout to fetch results after 300 seconds
      const timeout = setTimeout(() => {
        fetchRecentAnalysis();
        clearInterval(countdownInterval);
      }, 300000);
      
      setProcessingTimeout(timeout);

    } catch (error: any) {
      console.error('Error uploading video:', error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error uploading video",
      });
    } finally {
      setUploading(false);
    }
  }, [navigate, toast]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Clean up timeout on component unmount
  useEffect(() => {
    return () => {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
    };
  }, [processingTimeout]);

  return (
    <div className="min-h-screen bg-[#1a1625]">
      <Navbar email={user?.email || ""} />
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main content area */}
          <div className="flex-1">
            <Card className="bg-[#2d2640] border-0 shadow-xl w-full max-w-[60rem] mx-auto">
              <CardHeader className="pb-0 pt-4">
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  <CardTitle className="text-12 text-white">Upload New Video</CardTitle>
                </div>
                <CardDescription className="text-gray-400 text-sm mt-1">
                  Upload your video file for attention analysis. Supported formats: MP4, AVI, MOV
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center 
                    ${uploading ? 'border-purple-500 bg-purple-500/5' : 'border-gray-700 hover:border-purple-500 hover:bg-purple-500/5'} 
                    transition-all duration-300 cursor-pointer min-h-[200px] flex flex-col items-center justify-center`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                  
                  {!uploading && !isProcessing && (
                    <>
                      <div className="mb-4 p-3 rounded-full bg-purple-500/10">
                        <Upload className="w-8 h-8 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        Drop your video here
                      </h3>
                      <p className="text-gray-400 text-sm mb-4">
                        or drag and drop your video file
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 
                          transition-colors duration-300 flex items-center space-x-2 shadow-lg"
                        disabled={uploading}
                      >
                        <Upload className="w-4 h-4" />
                        <span>Choose Video File</span>
                      </button>
                      <p className="text-gray-500 text-xs mt-3">
                        Maximum file size: 500MB
                      </p>
                    </>
                  )}

                  {uploading && (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-3"></div>
                      <p className="text-base font-medium text-white">Uploading video...</p>
                      <p className="text-gray-400 text-sm mt-1">Please wait while we process your file</p>
                    </div>
                  )}

                  {isProcessing && !uploading && (
                    <div className="text-center">
                      <div className="mb-3 relative">
                        <div className="w-12 h-12 rounded-full border-3 border-purple-500/30 flex items-center justify-center">
                          <div className="text-lg font-bold text-purple-400">{countdown}</div>
                        </div>
                        <div className="absolute inset-0 rounded-full border-3 border-purple-500 border-t-transparent animate-spin"></div>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">Processing Video</h3>
                      <p className="text-gray-400 text-sm">
                        Analysis will be ready in <span className="text-purple-400 font-medium">{countdown}</span> seconds
                      </p>
                    </div>
                  )}
                </div>

                {/* File requirements info */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="bg-[#1a1625] rounded-lg p-3 flex items-start space-x-2">
                    <div className="p-1.5 rounded-full bg-purple-500/10">
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">File Type</h4>
                      <p className="text-gray-400 text-xs">MP4, AVI, MOV</p>
                    </div>
                  </div>
                  <div className="bg-[#1a1625] rounded-lg p-3 flex items-start space-x-2">
                    <div className="p-1.5 rounded-full bg-purple-500/10">
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">Max Size</h4>
                      <p className="text-gray-400 text-xs">500MB</p>
                    </div>
                  </div>
                  <div className="bg-[#1a1625] rounded-lg p-3 flex items-start space-x-2">
                    <div className="p-1.5 rounded-full bg-purple-500/10">
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">Processing</h4>
                      <p className="text-gray-400 text-xs">~Depends upon video size</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Section */}
            {recentAnalysis.length > 0 && (
              <div className="mt-8">
                <h3 className="text-2xl font-bold text-white mb-6 border-b border-[#2d2640] pb-2">
                  Latest Analysis Results - {recentAnalysis[0].video_title}
                  <span className="text-gray-500 text-sm ml-2">
                    {new Date(recentAnalysis[0].created_at).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recentAnalysis.map((result, index) => (
                    <div key={index} className="bg-[#2d2640] rounded-lg overflow-hidden shadow-lg">
                      <div className="p-6 flex justify-between items-start">
                        <div>
                          <h3 className="text-white text-xl mb-2">
                            Id: {result.st_id}
                          </h3>
                          <div className="space-y-2">
                            <p className="text-white text-lg">
                              Status: {result.attention_percentage >= 50 ? 'Attentive' : 'Not Attentive'}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {new Date(result.created_at).toLocaleTimeString('en-US', {
                                hour12: false,
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        {result.image && (
                          <div className="w-[5.3rem] h-[8rem] rounded-lg overflow-hidden">
                            <img
                              src={result.image}
                              alt={`Student ${result.st_id}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                      <div className="px-6 pb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white">Attention Score</span>
                          <span className="text-white font-semibold">
                            {result.attention_percentage?.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full bg-[#1a1625] rounded-full h-2">
                          <div 
                            className={`rounded-full h-2 transition-all duration-500 ${
                              result.attention_percentage >= 50 ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, result.attention_percentage || 0))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Average Score Section */}
          {averageAttention !== null && recentAnalysis.length > 0 && (
            <div className="lg:w-80">
              <div className="sticky top-4">
                <div className="bg-[#2d2640] rounded-lg p-6 shadow-lg">
                  <h4 className="text-xl font-bold text-white mb-4">Average Attention Score</h4>
                  <div className="text-4xl font-bold text-white mb-4">
                    {averageAttention.toFixed(2)}%
                  </div>
                  <div className="space-y-2">
                    <div className="w-full bg-[#1a1625] rounded-full h-2">
                      <div 
                        className={`rounded-full h-2 transition-all duration-500 ${
                          averageAttention >= 50 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, averageAttention))}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-400">
                      Based on {recentAnalysis.length} student{recentAnalysis.length > 1 ? 's' : ''} analyzed at{' '}
                      {new Date(recentAnalysis[0].created_at).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewAnalysis;
