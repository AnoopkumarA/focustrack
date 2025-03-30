import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import TypewriterText from "@/components/TypewriterText";

const Index = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [groupedResults, setGroupedResults] = useState<{ [key: string]: any[] }>({});

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group results by date and time
      const grouped = (data || []).reduce((acc: { [key: string]: { [key: string]: any[] } }, result) => {
        const date = new Date(result.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        const time = new Date(result.created_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });

        if (!acc[date]) {
          acc[date] = {};
        }
        if (!acc[date][time]) {
          acc[date][time] = [];
        }
        acc[date][time].push(result);
        return acc;
      }, {});

      setGroupedResults(grouped);
      setStudents(data || []);
    } catch (error: any) {
      console.error('Error fetching results:', error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1625] relative overflow-hidden">
      {/* Purple fog/cloud effect background */}
      <div className="absolute inset-0 overflow-hidden z-0">
       </div>
       
      <div className="relative z-10">
        <Navbar email={user?.email || ""} />
        <div className="container mx-auto py-8 px-4 relative">
          <div className="mb-12 text-center relative">
            
          {/* Welcome Section with Image */}
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
            <div className="md:w-3/5 text-left">
              <h2 className="text-[2.9rem] font-bold text-[#a04bd8] mb-4 ">
                FocusTrack
              </h2>
              <p className="text-[#a04bd8] italic text-lg mb-6 -mt-[1.45rem]">
                Empowering Education Through Intelligent Insights.
              </p>
              <TypewriterText
                paragraphs={[
                  "Welcome to FocusTrack, the ultimate platform for monitoring and enhancing student performance. Powered by cutting-edge artificial intelligence, FocusTrack offers educators real-time insights into classroom dynamics, enabling smarter decision-making and personalized learning experiences.",
                  "Whether tracking attendance, assessing participation, or identifying areas for improvement, FocusTrack ensures that every student receives the attention they deserve. Join us in revolutionizing education with data-driven solutions that empower teachers and inspire learners to reach their full potential."
                ]}
                className="text-gray-300 text-[1.1rem] leading-relaxed font-mono"
                delay={30}
              />
            </div>
            <div className="md:w-2/5 flex justify-center relative top-10">
              <img 
                src="/image.png" 
                alt="Student using computer"
                className="w-[14rem] max-w-md h-[14rem]"
              />
            </div>
          </div>
            {/* Glowing heading effect */}
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-4 relative">
              <span className="absolute inset-0 blur-xl bg-[#892CDC] opacity-75 w-[26rem] left-1/2 -translate-x-1/2" />
              <span className="relative text-[#a04bd8]">Previous Analysis</span>
            </h1>
            <div className="w-64 h-1 mx-auto mb-6" />
          </div>


          {Object.entries(groupedResults).length > 0 ? (
            Object.entries(groupedResults).map(([date, timeGroups]) => (
              <div key={date} className="mb-10 relative">
                <h2 className="text-2xl font-bold text-white mb-6 border-b border-purple-600/20 pb-2">
                  {date}
                </h2>
                {Object.entries(timeGroups).map(([time, dateResults]) => (
                  <div key={time} className="mb-8">
                    <h3 className="text-xl font-semibold text-purple-400 mb-4 ml-2">
                    Generated Time: {time}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dateResults.map((student) => (
                        <div key={student.st_id} className="bg-[#2d2640] rounded-lg overflow-hidden shadow-lg relative">
                          <div className="absolute inset-0 bg-gradient-to-b from-purple-600/5 to-transparent opacity-50" />
                          <div className="p-6 flex justify-between items-start relative">
                            <div>
                              <h3 className="text-white text-xl mb-2">
                                Id: {student.st_id}
                              </h3>
                              <div className="space-y-2">
                                <p className="text-white text-lg">
                                  Status: {student.attention_percentage >= 50 ? 'Attentive' : 'Not Attentive'}
                                </p>
                              </div>
                            </div>
                            {student.image && (
                              <div className="w-[5.3rem] h-[8rem] rounded-lg overflow-hidden">
                                <img
                                  src={student.image}
                                  alt={`Student ${student.st_id}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                          <div className="px-6 pb-6 relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white">Attention Score</span>
                              <span className="text-white font-semibold">
                                {student.attention_percentage?.toFixed(2)}%
                              </span>
                            </div>
                            <div className="w-full bg-[#1a1625] rounded-full h-2">
                              <div 
                                className={`rounded-full h-2 transition-all duration-500 ${
                                  student.attention_percentage >= 50 ? 'bg-green-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, student.attention_percentage || 0))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="text-center p-8 bg-[#2d2640] rounded-lg relative">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-600/5 to-transparent opacity-50" />
              <div className="relative">
                <p className="text-xl text-white">Welcome to Your Dashboard</p>
                <p className="text-gray-400 mt-2">
                  Start by uploading a video in the New Analysis section to begin monitoring attention levels.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
