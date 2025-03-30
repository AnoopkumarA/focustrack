import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

const PastAnalysis = () => {
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
    <div className="min-h-screen bg-[#1a1625]">
      <Navbar email={user?.email || ""} />
      <div className="container mx-auto py-8 px-4">
        {Object.entries(groupedResults).length > 0 ? (
          Object.entries(groupedResults).map(([date, timeGroups]) => (
            <div key={date} className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-6 border-b border-[#2d2640] pb-2">
                {date}
              </h2>
              {Object.entries(timeGroups).map(([time, dateResults]) => (
                <div key={time} className="mb-8">
                  <h3 className="text-xl font-semibold text-purple-400 mb-4 ml-2">
                    Generated Time: {time}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dateResults.map((student) => (
                      <div key={student.st_id} className="bg-[#2d2640] rounded-lg overflow-hidden shadow-lg">
                        <div className="p-6 flex justify-between items-start">
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
                        <div className="px-6 pb-6">
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
          <div className="text-center p-6 bg-[#2d2640] rounded-lg">
            <p className="text-lg text-white">No analysis results available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PastAnalysis;
