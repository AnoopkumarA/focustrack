import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, User, Pencil, Check, X as Close } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DatabaseProfile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  institution: string | null;
  subjects: string[] | null;
  profile_picture: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  institution: string;
  subjects: string[];
  profile_picture?: string;
  created_at?: string;
  updated_at?: string;
}

interface NavbarProps {
  email: string;
}

const Navbar = ({ email }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<UserProfile>({
    id: "",
    email,
    username: email.split('@')[0],
    full_name: "",
    institution: "",
    subjects: [],
    profile_picture: undefined
  });
  const [editedData, setEditedData] = useState<UserProfile>({
    id: "",
    email,
    username: email.split('@')[0],
    full_name: "",
    institution: "",
    subjects: [],
    profile_picture: undefined
  });
  const [newSubject, setNewSubject] = useState("");
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchUserProfile();
  }, [email]);

  const fetchUserProfile = async () => {
    try {
      // First get the user's ID from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<DatabaseProfile>();

      if (error) {
        if (error.code === 'PGRST116') { // No data found
          // Create a new profile if it doesn't exist
          const newProfile: UserProfile = {
            id: user.id,
            email,
            username: email.split('@')[0],
            full_name: "",
            institution: "",
            subjects: [],
          };
          await createUserProfile(newProfile);
          setProfileData(newProfile);
          setEditedData(newProfile);
        } else {
          throw error;
        }
      }

      if (data) {
        const profile: UserProfile = {
          id: data.id,
          email: data.email || email,
          username: data.username || email.split('@')[0],
          full_name: data.full_name || "",
          institution: data.institution || "",
          subjects: data.subjects || [],
          profile_picture: data.profile_picture || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        setProfileData(profile);
        setEditedData(profile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createUserProfile = async (profile: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{
          id: profile.id,
          email: profile.email,
          username: profile.username,
          full_name: profile.full_name || null,
          institution: profile.institution || null,
          subjects: profile.subjects || [],
          profile_picture: profile.profile_picture || null
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const updateUserProfile = async (profile: Partial<UserProfile>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Check if username is being updated
      if (profile.username && profile.username !== profileData.username) {
        // Check if username is already taken
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', profile.username)
          .single();

        if (existingUser) {
          throw new Error('Username is already taken. Please choose a different username.');
        }
      }

      console.log('Updating profile with data:', {
        username: profile.username,
        full_name: profile.full_name,
        institution: profile.institution,
        subjects: profile.subjects,
        profile_picture: profile.profile_picture
      });

      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: profile.username,
          full_name: profile.full_name || null,
          institution: profile.institution || null,
          subjects: profile.subjects || [],
          profile_picture: profile.profile_picture || null
        })
        .eq('id', user.id)
        .select<'*', DatabaseProfile>()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        if (error.code === '23505') { // PostgreSQL unique violation code
          throw new Error('Username is already taken. Please choose a different username.');
        }
        throw error;
      }

      console.log('Update successful, received data:', data);
      
      // Update local state with the returned data
      if (data) {
        const updatedProfile: UserProfile = {
          id: data.id,
          email: data.email,
          username: data.username,
          full_name: data.full_name || "",
          institution: data.institution || "",
          subjects: data.subjects || [],
          profile_picture: data.profile_picture || undefined,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
        setProfileData(updatedProfile);
        setEditedData(updatedProfile);
      }
      
      setIsProfileOpen(true); // Keep the dropdown open after save
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed');
        return;
      }

      setIsLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Update profile with new picture URL
      await updateUserProfile({
        ...editedData,
        profile_picture: publicUrl
      });

    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      alert(`Failed to upload profile picture: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "New Analysis", path: "/new-analysis" },
    { name: "Past Analysis", path: "/past-analysis" },
  ];

  const isActivePath = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/auth");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedData(profileData);
  };

  const handleSave = async () => {
    try {
      const username = editedData.username?.trim();
      if (!username) {
        alert('Username cannot be empty');
        return;
      }

      // Basic username validation
      if (username.length < 3) {
        alert('Username must be at least 3 characters long');
        return;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        alert('Username can only contain letters, numbers, underscores, and hyphens');
        return;
      }
      
      setIsLoading(true);
      await updateUserProfile(editedData);
      setIsEditing(false);
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert(error.message || 'Failed to save profile changes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData(profileData);
    setIsEditing(false);
    setNewSubject("");
  };

  const handleAddSubject = () => {
    if (newSubject.trim()) {
      setEditedData(prev => ({
        ...prev,
        subjects: [...prev.subjects, newSubject.trim()]
      }));
      setNewSubject("");
    }
  };

  const handleRemoveSubject = (index: number) => {
    setEditedData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }));
  };

  // Add this inside the profile editing section of the JSX, right after the username input
  const profilePictureUploadJSX = (
    <div className="px-4 py-2 border-b border-purple-900/50">
      <p className="text-xs text-gray-400">Profile Picture</p>
      <div className="flex items-center space-x-4 mt-2">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center">
          {editedData.profile_picture ? (
            <img src={editedData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-white" />
          )}
        </div>
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            onChange={handleProfilePictureUpload}
            className="hidden"
          />
          <span className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-150 inline-block">
            Upload New Picture
          </span>
        </label>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <nav className="bg-[#1a1625] border-b border-purple-900/100 relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <span className="text-2xl font-bold relative md:-left-16 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                FocusTrack
              </span>
            </div>
            <div className="animate-pulse bg-purple-600/20 h-8 w-32 rounded-lg"></div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-[#1a1625] border-b border-purple-900/100 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-bold relative md:-left-16 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                FocusTrack
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 relative ${
                  isActivePath(item.path)
                    ? "bg-purple-600/20 text-white"
                    : "text-gray-300 hover:bg-purple-600/10 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Profile Section */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-purple-600/10 transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center">
                  {profileData.profile_picture ? (
                    <img src={profileData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <span>{profileData.username}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-[#1a1625] border border-purple-900/50 rounded-lg shadow-lg py-2">
                  <div className="flex justify-between items-center px-4 py-2 border-b border-purple-900/50">
                    {!isEditing ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-400">Username</p>
                          <p className="text-sm font-medium text-white">{profileData.username}</p>
                        </div>
                        <button
                          onClick={handleEdit}
                          className="p-2 text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full">
                        <p className="text-xs text-gray-400">Username</p>
                        <input
                          type="text"
                          value={editedData.username}
                          onChange={(e) => setEditedData(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full bg-[#2a2435] text-white rounded px-2 py-1 mt-1 text-sm"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="px-4 py-2 border-b border-purple-900/50">
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm text-white">{email}</p>
                  </div>

                  {isEditing ? (
                    <>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Full Name</p>
                        <input
                          type="text"
                          value={editedData.full_name}
                          onChange={(e) => setEditedData(prev => ({ ...prev, full_name: e.target.value }))}
                          className="w-full bg-[#2a2435] text-white rounded px-2 py-1 mt-1 text-sm"
                        />
                      </div>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Institution</p>
                        <input
                          type="text"
                          value={editedData.institution}
                          onChange={(e) => setEditedData(prev => ({ ...prev, institution: e.target.value }))}
                          className="w-full bg-[#2a2435] text-white rounded px-2 py-1 mt-1 text-sm"
                        />
                      </div>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Subjects Taught</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {editedData.subjects.map((subject, index) => (
                            <span key={index} className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded flex items-center">
                              {subject}
                              <button
                                onClick={() => handleRemoveSubject(index)}
                                className="ml-1 text-purple-400 hover:text-purple-300"
                              >
                                <Close className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex mt-2">
                          <input
                            type="text"
                            value={newSubject}
                            onChange={(e) => setNewSubject(e.target.value)}
                            placeholder="Add new subject"
                            className="flex-1 bg-[#2a2435] text-white rounded-l px-2 py-1 text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
                          />
                          <button
                            onClick={handleAddSubject}
                            className="px-2 py-1 bg-purple-600 text-white rounded-r text-sm hover:bg-purple-700"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {profilePictureUploadJSX}
                      <div className="px-4 py-2 flex space-x-2">
                        <button
                          onClick={handleSave}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-150"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors duration-150"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Full Name</p>
                        <p className="text-sm text-white">{profileData.full_name}</p>
                      </div>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Institution</p>
                        <p className="text-sm text-white">{profileData.institution}</p>
                      </div>
                      <div className="px-4 py-2">
                        <p className="text-xs text-gray-400">Subjects Taught</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profileData.subjects.map((subject, index) => (
                            <span key={index} className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded">
                              {subject}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="px-4 py-2 mt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-150"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-purple-600/10 focus:outline-none relative"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`${
          isMenuOpen ? "block" : "hidden"
        } md:hidden bg-[#1a1625] border-b border-purple-900/20 relative`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          {/* Profile Section for Mobile */}
          <div className="px-3 py-2 border-b border-purple-900/50 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 flex items-center justify-center">
                  {profileData.profile_picture ? (
                    <img src={profileData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{profileData.username}</p>
                  <p className="text-xs text-gray-400">{email}</p>
                </div>
              </div>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="p-2 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs text-gray-400">Full Name</p>
                  <input
                    type="text"
                    value={editedData.full_name}
                    onChange={(e) => setEditedData(prev => ({ ...prev, full_name: e.target.value }))}
                    className="w-full bg-[#2a2435] text-white rounded px-2 py-1 mt-1 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Institution</p>
                  <input
                    type="text"
                    value={editedData.institution}
                    onChange={(e) => setEditedData(prev => ({ ...prev, institution: e.target.value }))}
                    className="w-full bg-[#2a2435] text-white rounded px-2 py-1 mt-1 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Subjects Taught</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editedData.subjects.map((subject, index) => (
                      <span key={index} className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded flex items-center">
                        {subject}
                        <button
                          onClick={() => handleRemoveSubject(index)}
                          className="ml-1 text-purple-400 hover:text-purple-300"
                        >
                          <Close className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex mt-2">
                    <input
                      type="text"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Add new subject"
                      className="flex-1 bg-[#2a2435] text-white rounded-l px-2 py-1 text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSubject()}
                    />
                    <button
                      onClick={handleAddSubject}
                      className="px-2 py-1 bg-purple-600 text-white rounded-r text-sm hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
                {profilePictureUploadJSX}
                <div className="flex space-x-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors duration-150"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-2">
                  <p className="text-xs text-gray-400">Full Name</p>
                  <p className="text-sm text-white">{profileData.full_name}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-400">Institution</p>
                  <p className="text-sm text-white">{profileData.institution}</p>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-400">Subjects Taught</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profileData.subjects.map((subject, index) => (
                      <span key={index} className="text-xs bg-purple-600/20 text-purple-300 px-2 py-1 rounded">
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-base font-medium relative ${
                isActivePath(item.path)
                  ? "bg-purple-600/20 text-white"
                  : "text-gray-300 hover:bg-purple-600/10 hover:text-white"
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-150 relative"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
