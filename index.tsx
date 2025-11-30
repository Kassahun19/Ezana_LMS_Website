import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

/* 
================================================================================
   SERVER & DATABASE SETUP INSTRUCTIONS
================================================================================
   (Same as previous instructions - connect to XAMPP if needed)
*/

// --- CONFIGURATION ---

const USE_API = false; // <--- SET THIS TO TRUE TO USE YOUR XAMPP DATABASE
const API_URL = "http://localhost/ezana/api.php";

// --- Types & Interfaces ---

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "instructor" | "admin";
  avatar?: string;
  title?: string;
  bio?: string;
  joinDate?: string;
}

interface Course {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
  instructorName: string;
  instructorId?: string;
  price: number;
  rating: number;
  students: number;
  phases?: CoursePhase[];
  progress?: number;
}

interface CoursePhase {
  id: string;
  title: string;
  playlistId?: string;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  type: "video" | "pdf" | "quiz";
  url?: string;
  duration?: string;
  completed?: boolean;
}

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  videoId: string;
}

// --- Constants ---

const YOUTUBE_API_KEY = "AIzaSyCJktqWHyapr-JTlOfoyWpXdYkoH5RF6Co";
const DEFAULT_CEO_IMAGE = "Kassahun.jpg";
const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200";

// --- Mock Data ---
const COURSE_STRUCTURE: Course[] = [
  {
    id: "c1",
    title: "Full Stack Web Development",
    category: "web-dev",
    description: "Master HTML, CSS, JS, React, Node.js and build real apps.",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=600",
    instructorName: "Kassahun Mulatu",
    instructorId: "instructor",
    price: 2500, // ETB
    rating: 4.9,
    students: 1250,
    phases: [
      // Verified Public Playlist: CodeWithHarry Web Dev
      {
        id: "p1",
        title: "Full Stack Foundation",
        playlistId: "PLu0W_9lII9agq5TrH9XLIKQvv0iaF2X3w",
        lessons: [],
      },
    ],
  },
  {
    id: "c2",
    title: "Mathematics (Grades 7-12)",
    category: "math",
    description: "Complete curriculum for high school mathematics.",
    image:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=600",
    instructorName: "Ezana Team",
    instructorId: "admin",
    price: 1500, // ETB
    rating: 4.8,
    students: 3400,
    phases: [
      // Verified Public Playlist: Khan Academy Algebra I
      {
        id: "p2",
        title: "Algebra & Calculus Fundamentals",
        playlistId: "PL7AF1C14AF1B05894",
        lessons: [],
      },
    ],
  },
  {
    id: "c3",
    title: "English Language Mastery",
    category: "english",
    description: "Improve your spoken and written English skills.",
    image:
      "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=600",
    instructorName: "Sarah James",
    instructorId: "instructor2",
    price: 1000, // ETB
    rating: 4.7,
    students: 2100,
    phases: [
      // Verified Public Playlist: BBC Learning English - Grammar
      {
        id: "p3",
        title: "Grammar and Spoken English",
        playlistId: "PLcetZ6gSk96-5vD0x-d-YmO1_Nn-aO6l",
        lessons: [],
      },
    ],
  },
];

// --- Database Service ---

const apiRequest = async (action: string, body?: any) => {
  try {
    const options: RequestInit = {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`${API_URL}?action=${action}`, options);
    if (!response.ok) throw new Error("Network response was not ok");
    return await response.json();
  } catch (e) {
    console.error(`API Fail [${action}]:`, e);
    return null;
  }
};

const delay = <T,>(data: T, ms = 300): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

const DB = {
  api: apiRequest,
  delay: delay,

  getSettings: async () => {
    if (USE_API)
      return (
        (await apiRequest("get_settings")) || { ceoImage: DEFAULT_CEO_IMAGE }
      );
    try {
      const settings = localStorage.getItem("ezana_settings");
      return delay(
        settings ? JSON.parse(settings) : { ceoImage: DEFAULT_CEO_IMAGE }
      );
    } catch (e) {
      return delay({ ceoImage: DEFAULT_CEO_IMAGE });
    }
  },

  updateSettings: async (newSettings: any) => {
    if (USE_API) return await apiRequest("update_settings", newSettings);
    const current = await DB.getSettings();
    localStorage.setItem(
      "ezana_settings",
      JSON.stringify({ ...current, ...newSettings })
    );
    return delay(true);
  },

  getUser: async (): Promise<User | null> => {
    try {
      const user = localStorage.getItem("ezana_user");
      return delay(user ? JSON.parse(user) : null, 50);
    } catch (e) {
      return delay(null);
    }
  },

  setUser: async (user: User) => {
    localStorage.setItem("ezana_user", JSON.stringify(user));
    if (USE_API) {
      await apiRequest("save_user", user);
    } else {
      const users = await DB.getUsers();
      if (!users.find((u: User) => u.email === user.email)) {
        users.push({
          ...user,
          joinDate: new Date().toISOString().split("T")[0],
        });
        localStorage.setItem("ezana_users", JSON.stringify(users));
      } else {
        // Update existing in list
        const idx = users.findIndex((u) => u.email === user.email);
        if (idx > -1) {
          users[idx] = { ...users[idx], ...user };
          localStorage.setItem("ezana_users", JSON.stringify(users));
        }
      }
    }
    return delay(true);
  },

  logout: async () => {
    localStorage.removeItem("ezana_user");
    return delay(true, 50);
  },

  getUsers: async (): Promise<User[]> => {
    if (USE_API) return (await apiRequest("get_users")) || [];
    try {
      const users = localStorage.getItem("ezana_users");
      return delay(
        users
          ? JSON.parse(users)
          : [
              {
                id: "admin",
                name: "Admin User",
                email: "admin@ezana.com",
                role: "admin",
                joinDate: "2023-01-01",
                avatar: DEFAULT_AVATAR,
                title: "System Administrator",
              },
              {
                id: "instructor",
                name: "Instructor Doe",
                email: "instructor@ezana.com",
                role: "instructor",
                joinDate: "2023-02-15",
                avatar: DEFAULT_AVATAR,
                title: "Senior Web Instructor",
              },
              {
                id: "student",
                name: "Student Smith",
                email: "student@ezana.com",
                role: "student",
                joinDate: "2023-03-10",
                avatar: DEFAULT_AVATAR,
                title: "Aspiring Developer",
              },
            ]
      );
    } catch (e) {
      return delay([]);
    }
  },

  deleteUser: async (id: string) => {
    if (USE_API) return;
    let users = await DB.getUsers();
    users = users.filter((u: User) => u.id !== id);
    localStorage.setItem("ezana_users", JSON.stringify(users));
    return delay(true);
  },

  updateUser: async (updatedUser: User) => {
    if (USE_API) return await DB.setUser(updatedUser);
    let users = await DB.getUsers();
    const index = users.findIndex((u: User) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedUser };
      localStorage.setItem("ezana_users", JSON.stringify(users));
    }

    // Update session if self
    const currentUserStr = localStorage.getItem("ezana_user");
    if (currentUserStr) {
      const currentUser = JSON.parse(currentUserStr);
      if (currentUser.id === updatedUser.id) {
        localStorage.setItem(
          "ezana_user",
          JSON.stringify({ ...currentUser, ...updatedUser })
        );
      }
    }
    return delay(true);
  },

  getCourses: async (): Promise<Course[]> => {
    try {
      const stored = localStorage.getItem("ezana_courses");
      let courses = stored ? JSON.parse(stored) : COURSE_STRUCTURE;

      // Fixes "Playlist not found" error:
      // If we have stored courses, we MUST overwrite the Phases with the hardcoded COURSE_STRUCTURE phases.
      // This ensures that if we update the Playlist IDs in the code (like we just did),
      // the browser's old local storage data doesn't override it with the old, broken IDs.
      if (courses.length > 0) {
        courses = courses.map((c: Course) => {
          const staticCourse = COURSE_STRUCTURE.find((sc) => sc.id === c.id);
          if (staticCourse) {
            return {
              ...c,
              price: staticCourse.price,
              phases: staticCourse.phases,
              category: staticCourse.category, // Ensure category is synced for mock videos
            };
          }
          return c;
        });
      }
      return delay(courses);
    } catch (e) {
      return delay(COURSE_STRUCTURE);
    }
  },

  addCourse: async (course: Course) => {
    let courses = await DB.getCourses();
    courses.push(course);
    localStorage.setItem("ezana_courses", JSON.stringify(courses));
    return delay(true);
  },

  deleteCourse: async (id: string) => {
    let courses = await DB.getCourses();
    courses = courses.filter((c: Course) => c.id !== id);
    localStorage.setItem("ezana_courses", JSON.stringify(courses));
    return delay(true);
  },
};

// --- Utilities & Hooks ---

const useCountUp = (
  end: number,
  duration: number = 2000,
  suffix: string = ""
) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);

  return {
    ref: elementRef,
    value: `${Math.floor(count).toLocaleString()}${suffix}`,
  };
};

// --- Shared Components ---

const AnimatedStat: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const numericPart = parseInt(value.replace(/[^0-9]/g, ""));
  const suffix = value.replace(/[0-9,]/g, "");
  const { ref, value: animatedValue } = useCountUp(
    numericPart || 0,
    2000,
    suffix
  );

  return (
    <div
      ref={ref}
      className="text-center group p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
    >
      <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1 group-hover:scale-110 transition-transform duration-300">
        {animatedValue}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-16 pb-8 text-slate-600 dark:text-slate-400 mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white font-bold text-lg">
              E
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-display font-bold text-slate-900 dark:text-white leading-none">
                Ezana
              </span>
              <span className="text-[0.6rem] font-bold text-brand-600 uppercase tracking-wider">
                Unlock your potential
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed">
            Empowering students across Ethiopia with world-class education in
            technology, mathematics, and languages.
          </p>
          <div className="flex gap-4">
            {["twitter", "facebook", "instagram", "linkedin"].map((i) => (
              <a
                key={i}
                href="#"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-brand-500 hover:text-white transition-all"
              >
                <i className={`fab fa-${i}`}></i>
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-4">
            Platform
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="#" className="hover:text-brand-600">
                Browse Courses
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Our Instructors
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Success Stories
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Pricing Plans
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-4">
            Resources
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="#" className="hover:text-brand-600">
                Documentation
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Community Forum
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Help Center
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-brand-600">
                Terms of Service
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-4">
            Contact
          </h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <i className="fas fa-envelope text-brand-500"></i>{" "}
              kmulatu21@gmail.com
            </li>
            <li className="flex items-center gap-2">
              <i className="fas fa-phone text-brand-500"></i> +251 915508167
            </li>
            <li className="flex items-center gap-2">
              <i className="fas fa-map-marker-alt text-brand-500"></i> Bahir
              Dar, Ethiopia
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <p>
          &copy; 2025 Ezana Academy. All rights reserved | Built by Kassahun
          Mulatu
        </p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-brand-600">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-brand-600">
            Cookie Policy
          </a>
        </div>
      </div>
    </div>
  </footer>
);

const Navbar = ({
  user,
  onLoginClick,
  onLogout,
  onContactClick,
  darkMode,
  toggleDarkMode,
  onSearch,
  onNavClick,
  alwaysSolid,
}: any) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const isDashboard =
    typeof window !== "undefined" && window.location.hash === "#dashboard";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const useSolidBg = isScrolled || isDashboard || alwaysSolid;
  const navClass = useSolidBg
    ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md py-3"
    : "bg-transparent py-5";
  const textClass = "text-slate-800 dark:text-white";

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${navClass}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            window.location.hash = "home";
            onNavClick?.("home");
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-105 transition-transform">
            E
          </div>
          <div className="flex flex-col">
            <span
              className={`text-xl font-display font-bold tracking-tight leading-none ${textClass}`}
            >
              Ezana
              <span className="text-brand-600 dark:text-brand-400">
                Academy
              </span>
            </span>
            <span className="text-[0.6rem] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider leading-tight">
              Unlock your potential
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <form onSubmit={handleSearchSubmit} className="relative group">
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-brand-500 text-sm w-48 transition-all focus:w-64 text-slate-800 dark:text-white placeholder-slate-500"
            />
            <i className="fas fa-search absolute left-3 top-2.5 text-slate-500"></i>
          </form>

          {["Home", "Courses", "About"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={(e) => {
                e.preventDefault();
                const id = item.toLowerCase();
                window.location.hash = id;
                onNavClick?.(id);
              }}
              className={`font-medium hover:text-brand-600 transition-colors ${textClass} relative after:content-[''] after:absolute after:w-0 after:h-0.5 after:bg-brand-600 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}
            >
              {item}
            </a>
          ))}

          <a
            href="https://kmdev.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium hover:text-brand-600 transition-colors ${textClass} relative after:content-[''] after:absolute after:w-0 after:h-0.5 after:bg-brand-600 after:left-0 after:-bottom-1 after:transition-all hover:after:w-full`}
          >
            Portfolio
          </a>

          <button
            onClick={onContactClick}
            className={`font-medium hover:text-brand-600 transition-colors ${textClass} flex items-center gap-2`}
          >
            Contact
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${textClass}`}
          >
            <i className={`fas ${darkMode ? "fa-sun" : "fa-moon"}`}></i>
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <a
                href="#dashboard"
                className="hidden md:block font-medium hover:text-brand-600 transition-colors text-sm"
              >
                Dashboard
              </a>
              <div
                className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 pr-4 rounded-full pl-1 py-1 hover:shadow-md transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                onClick={onLogout}
                title="Logout"
              >
                <img
                  src={user.avatar || DEFAULT_AVATAR}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
                  {user.name}
                </span>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => onLoginClick(false)}
                className={`font-medium hidden md:block hover:text-brand-600 transition-colors ${textClass}`}
              >
                Login
              </button>
              <button
                onClick={() => onLoginClick(true)}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-600 to-accent-600 text-white font-medium shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-0.5 transition-all"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const StatusMessage = ({
  type,
  message,
}: {
  type: "success" | "error" | null;
  message: string;
}) => {
  if (!type || !message) return null;
  return (
    <div
      className={`p-3 rounded-lg text-sm mb-4 flex items-center gap-2 animate-fade-in ${
        type === "success"
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      }`}
    >
      <i
        className={`fas ${
          type === "success" ? "fa-check-circle" : "fa-exclamation-circle"
        }`}
      ></i>
      {message}
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <i className="fas fa-spinner fa-spin text-4xl text-brand-500"></i>
  </div>
);

// --- Forms ---

const ProfileSettingsForm = ({ user }: { user: User }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    title: user.title || "",
    bio: user.bio || "",
    avatar: user.avatar || DEFAULT_AVATAR,
  });
  const [status, setStatus] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await DB.updateUser({ ...user, ...formData });
    setStatus({ type: "success", msg: "Profile updated successfully!" });
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm animate-fade-in border border-slate-100 dark:border-slate-700">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Profile Settings
        </h3>
      </div>
      <form onSubmit={handleSave} className="p-8 space-y-6">
        <StatusMessage type={status?.type as any} message={status?.msg || ""} />

        <div className="flex items-center gap-6 mb-6">
          <img
            src={formData.avatar}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 dark:border-slate-700 shadow-md"
          />
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Avatar URL
            </label>
            <input
              type="text"
              value={formData.avatar}
              onChange={(e) =>
                setFormData({ ...formData, avatar: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Paste a direct link to an image to update your profile picture.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Professional Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g. Senior Web Developer"
              className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bio
            </label>
            <textarea
              rows={4}
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              placeholder="Tell us about yourself..."
              className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            ></textarea>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 mt-1">
              Email cannot be changed.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium shadow-md"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

// --- Dashboards ---

const AdminDashboard = ({ activeTab }: { activeTab: string }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([DB.getUsers(), DB.getCourses()]).then(([u, c]) => {
      setUsers(u);
      setCourses(c);
    });
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      await DB.deleteUser(id);
      loadData();
    }
  };

  const renderReports = () => (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
        System Analytics
      </h3>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-bold text-slate-700 dark:text-slate-200">
            Traffic Overview
          </h4>
          <select className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-xs">
            <option>Last 30 Days</option>
            <option>Last Year</option>
          </select>
        </div>
        <div className="h-48 flex items-end justify-between gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-brand-100 dark:bg-brand-900/30 rounded-t h-full relative group"
            >
              <div
                className="absolute bottom-0 w-full bg-brand-500 rounded-t transition-all duration-500 group-hover:bg-brand-400"
                style={{ height: `${Math.random() * 80 + 10}%` }}
              ></div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>Jan</span>
          <span>Dec</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h4 className="font-bold mb-4 text-slate-900 dark:text-white">
            Recent Logs
          </h4>
          <div className="space-y-2 text-xs font-mono text-slate-600 dark:text-slate-400 h-40 overflow-y-auto">
            <p>[INFO] User login: admin@ezana.com (IP: 192.168.1.1)</p>
            <p>[INFO] New course created: "Advanced React"</p>
            <p>[WARN] API Latency high on /get_courses</p>
            <p>[INFO] Backup completed successfully</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h4 className="font-bold mb-4 text-slate-900 dark:text-white">
            Server Health
          </h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>CPU</span>
                <span>45%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full">
                <div className="bg-green-500 h-2 rounded-full w-[45%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>RAM</span>
                <span>72%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full">
                <div className="bg-yellow-500 h-2 rounded-full w-[72%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Storage</span>
                <span>28%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full">
                <div className="bg-blue-500 h-2 rounded-full w-[28%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 animate-fade-in border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          User Management
        </h3>
        <button className="text-xs bg-brand-600 text-white px-3 py-2 rounded hover:bg-brand-700">
          Add User
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((u) => (
              <tr
                key={u.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="px-4 py-3 flex items-center gap-3">
                  <img
                    src={u.avatar || DEFAULT_AVATAR}
                    className="w-8 h-8 rounded-full"
                  />
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {u.name}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      u.role === "admin"
                        ? "bg-red-100 text-red-700"
                        : u.role === "instructor"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {u.joinDate || "N/A"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  switch (activeTab) {
    case "reports":
      return renderReports();
    case "users":
      return renderUsers();
    case "courses":
      return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl">
          <h3 className="font-bold mb-4 text-slate-900 dark:text-white">
            Platform Courses
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {courses.map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center p-4 border rounded dark:border-slate-700"
              >
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {c.title}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {c.students} Students • ETB {c.price}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-brand-100 text-brand-700 rounded text-xs">
                    Edit
                  </button>
                  <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs">
                    Unpublish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="p-10 text-center text-slate-500">
          Welcome back, Admin. Select a tab.
        </div>
      );
  }
};

const InstructorDashboard = ({
  user,
  activeTab,
}: {
  user: User;
  activeTab: string;
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    price: 0,
    category: "web-dev",
  });
  const [status, setStatus] = useState("");

  useEffect(() => {
    DB.getCourses().then((c) =>
      setCourses(
        c.filter(
          (course) =>
            course.instructorId === user.id ||
            course.instructorId === "instructor"
        )
      )
    );
  }, [user.id]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseToAdd: Course = {
      id: "c" + Date.now(),
      ...newCourse,
      instructorName: user.name,
      instructorId: user.id,
      rating: 0,
      students: 0,
      image:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
      phases: [],
    };
    await DB.addCourse(courseToAdd);
    setCourses((prev) => [...prev, courseToAdd]);
    setNewCourse({ title: "", description: "", price: 0, category: "web-dev" });
    setStatus("Course created successfully!");
    setTimeout(() => setStatus(""), 3000);
  };

  const renderQA = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 animate-fade-in border border-slate-100 dark:border-slate-700">
      <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">
        Student Q&A
      </h3>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-4 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                S
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  How do I fix the CORS error?
                </h4>
                <p className="text-xs text-slate-500">
                  Student Name • Web Dev Course • 2 hrs ago
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 ml-11">
              I followed the tutorial but I'm getting a
              Access-Control-Allow-Origin error when fetching data.
            </p>
            <div className="ml-11 flex gap-2">
              <button className="text-xs px-3 py-1 bg-brand-100 text-brand-700 rounded-full font-bold">
                Reply
              </button>
              <button className="text-xs px-3 py-1 text-slate-500 hover:text-slate-700">
                Mark as Resolved
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCreateCourse = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 animate-fade-in border border-slate-100 dark:border-slate-700">
      <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">
        Create New Course
      </h3>
      {status && (
        <div className="p-3 bg-green-100 text-green-700 rounded mb-4">
          {status}
        </div>
      )}
      <form onSubmit={handleCreateCourse} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-300">
            Course Title
          </label>
          <input
            required
            type="text"
            value={newCourse.title}
            onChange={(e) =>
              setNewCourse({ ...newCourse, title: e.target.value })
            }
            className="w-full p-2 border rounded dark:bg-slate-900 dark:border-slate-600 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-300">
            Description
          </label>
          <textarea
            required
            rows={4}
            value={newCourse.description}
            onChange={(e) =>
              setNewCourse({ ...newCourse, description: e.target.value })
            }
            className="w-full p-2 border rounded dark:bg-slate-900 dark:border-slate-600 dark:text-white"
          ></textarea>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">
              Price (ETB)
            </label>
            <input
              required
              type="number"
              value={newCourse.price}
              onChange={(e) =>
                setNewCourse({
                  ...newCourse,
                  price: parseFloat(e.target.value),
                })
              }
              className="w-full p-2 border rounded dark:bg-slate-900 dark:border-slate-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-slate-300">
              Category
            </label>
            <select
              value={newCourse.category}
              onChange={(e) =>
                setNewCourse({ ...newCourse, category: e.target.value })
              }
              className="w-full p-2 border rounded dark:bg-slate-900 dark:border-slate-600 dark:text-white"
            >
              <option value="web-dev">Web Development</option>
              <option value="math">Mathematics</option>
              <option value="english">English</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
        >
          Create Course
        </button>
      </form>
    </div>
  );

  const renderEarnings = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 animate-fade-in">
      <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">
        Financial Overview
      </h3>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <div className="text-sm text-green-600 dark:text-green-400 font-bold uppercase">
            Total Revenue
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            ETB 624,500
          </div>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase">
            This Month
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            ETB 82,800
          </div>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
          <div className="text-sm text-purple-600 dark:text-purple-400 font-bold uppercase">
            Pending Payout
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            ETB 15,450
          </div>
        </div>
      </div>
      <div>
        <h4 className="font-bold mb-4 dark:text-white">Monthly Breakdown</h4>
        <div className="h-60 flex items-end justify-between gap-4">
          {[45, 60, 30, 70, 50, 80].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-brand-100 dark:bg-brand-900/20 rounded-t relative group h-full"
            >
              <div
                className="absolute bottom-0 w-full bg-brand-500 rounded-t transition-all group-hover:bg-brand-400"
                style={{ height: `${h}%` }}
              ></div>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                ETB {h * 1000}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  switch (activeTab) {
    case "qa":
      return renderQA();
    case "create-course":
      return renderCreateCourse();
    case "earnings":
      return renderEarnings();
    case "my-courses":
      return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-xl dark:text-white">My Courses</h3>
          </div>
          <div className="grid gap-4">
            {courses.length === 0 ? (
              <p className="text-slate-500">No courses yet.</p>
            ) : (
              courses.map((c) => (
                <div
                  key={c.id}
                  className="flex gap-4 p-4 border rounded dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <img
                    src={c.image}
                    className="w-24 h-16 object-cover rounded"
                  />
                  <div>
                    <h4 className="font-bold dark:text-white">{c.title}</h4>
                    <p className="text-xs text-slate-500">
                      {c.students} students enrolled
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    default:
      return (
        <div className="text-center py-20 text-slate-500">
          Welcome, Instructor. Select a tab.
        </div>
      );
  }
};

const StudentDashboard = ({
  user,
  activeTab,
}: {
  user: User;
  activeTab: string;
}) => {
  const renderMyLearning = () => (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">
        My Learning Progress
      </h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Mock enrolled courses */}
        {[
          {
            title: "Full Stack Web Development",
            progress: 65,
            image:
              "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600",
          },
          {
            title: "English Mastery",
            progress: 20,
            image:
              "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600",
          },
        ].map((c, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
          >
            <div
              className="h-32 bg-cover bg-center"
              style={{ backgroundImage: `url(${c.image})` }}
            ></div>
            <div className="p-4">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                {c.title}
              </h4>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{c.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-500 h-full rounded-full"
                  style={{ width: `${c.progress}%` }}
                ></div>
              </div>
              <button className="mt-4 w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded hover:opacity-90">
                Continue Learning
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCertificates = () => (
    <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-20 h-20 bg-brand-500 rotate-45 transform translate-x-10 -translate-y-10"></div>
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl mb-4">
            <i className="fas fa-certificate"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Web Development Bootcamp
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Completed on Oct 15, 2023
          </p>
          <button className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90">
            <i className="fas fa-download"></i> Download PDF
          </button>
        </div>
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 animate-fade-in border border-slate-100 dark:border-slate-700">
      <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">
        Course Resources
      </h3>
      <div className="space-y-3">
        {[
          { type: "pdf", name: "React Cheatsheet 2024", size: "2.4 MB" },
          { type: "zip", name: "Starter Code - Portfolio", size: "15 MB" },
          { type: "doc", name: "Study Guide - Week 1", size: "500 KB" },
        ].map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                  file.type === "pdf"
                    ? "bg-red-100 text-red-600"
                    : file.type === "zip"
                    ? "bg-yellow-100 text-yellow-600"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                <i
                  className={`fas fa-file-${
                    file.type === "zip" ? "archive" : file.type
                  }`}
                ></i>
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">
                  {file.name}
                </div>
                <div className="text-xs text-slate-500">{file.size}</div>
              </div>
            </div>
            <button className="text-slate-400 hover:text-brand-600">
              <i className="fas fa-download"></i>
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  switch (activeTab) {
    case "my-learning":
      return renderMyLearning();
    case "certificates":
      return renderCertificates();
    case "resources":
      return renderResources();
    // ... previous tabs ...
    default:
      return (
        <div className="text-center py-20 text-slate-500">
          Select a tab to view content
        </div>
      );
  }
};

const Dashboard = ({
  user,
  setSelectedCourse,
}: {
  user: User;
  setSelectedCourse: (c: any) => void;
}) => {
  const [activeTab, setActiveTab] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const tabs = useMemo(() => {
    const common = [
      { id: "settings", label: "Profile Settings", icon: "fa-cog" },
    ];
    if (user.role === "admin")
      return [
        { id: "overview", label: "Overview", icon: "fa-chart-pie" },
        { id: "users", label: "User Management", icon: "fa-users" },
        { id: "courses", label: "Course Management", icon: "fa-book-open" },
        { id: "financials", label: "Financials", icon: "fa-wallet" },
        { id: "reports", label: "System Reports", icon: "fa-server" },
        ...common,
      ];
    if (user.role === "instructor")
      return [
        { id: "dashboard", label: "Overview", icon: "fa-tachometer-alt" },
        {
          id: "my-courses",
          label: "My Courses",
          icon: "fa-chalkboard-teacher",
        },
        { id: "create-course", label: "Create Course", icon: "fa-plus-circle" },
        { id: "students", label: "My Students", icon: "fa-user-graduate" },
        { id: "assignments", label: "Assignments", icon: "fa-clipboard-list" },
        { id: "qa", label: "Q & A", icon: "fa-comments" },
        { id: "earnings", label: "Earnings", icon: "fa-dollar-sign" },
        ...common,
      ];
    return [
      // Student
      { id: "my-learning", label: "My Learning", icon: "fa-graduation-cap" },
      { id: "assignments", label: "My Assignments", icon: "fa-tasks" },
      { id: "wishlist", label: "Wishlist", icon: "fa-heart" },
      { id: "certificates", label: "Certificates", icon: "fa-certificate" },
      { id: "resources", label: "Resources", icon: "fa-folder-open" },
      { id: "purchase-history", label: "Purchase History", icon: "fa-history" },
      { id: "achievements", label: "Achievements", icon: "fa-trophy" },
      ...common,
    ];
  }, [user.role]);

  useEffect(() => {
    if (activeTab === "") {
      if (user.role === "admin") setActiveTab("overview");
      else if (user.role === "instructor") setActiveTab("dashboard");
      else setActiveTab("my-learning");
    }
  }, [user.role]);

  const renderContent = () => {
    if (user.role === "admin") {
      if (activeTab === "overview")
        return <AdminDashboard activeTab="reports" />;
      return <AdminDashboard activeTab={activeTab} />;
    } else if (user.role === "instructor") {
      return <InstructorDashboard user={user} activeTab={activeTab} />;
    } else {
      return <StudentDashboard user={user} activeTab={activeTab} />;
    }

    // Settings is common (though currently handled inside component switch in renderContent usually,
    // to make Settings global, we can intercept it)
    if (activeTab === "settings") return <ProfileSettingsForm user={user} />;

    return <div className="p-10">Select a tab</div>;
  };

  return (
    <div className="flex min-h-screen pt-20 bg-slate-50 dark:bg-slate-900 font-sans">
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-20 bottom-0 bg-white dark:bg-slate-800 shadow-xl transition-all duration-300 z-40 border-r border-slate-200 dark:border-slate-700 flex flex-col ${
          isSidebarOpen ? "w-72" : "w-20"
        }`}
      >
        {/* User Info in Sidebar */}
        <div
          className={`p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col items-center transition-all ${
            !isSidebarOpen && "px-2"
          }`}
        >
          <div className="relative mb-3">
            <img
              src={user.avatar || DEFAULT_AVATAR}
              alt={user.name}
              className={`rounded-full object-cover border-4 border-brand-50 dark:border-brand-900 transition-all ${
                isSidebarOpen ? "w-20 h-20" : "w-10 h-10"
              }`}
            />
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
          </div>
          {isSidebarOpen && (
            <div className="text-center animate-fade-in">
              <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {user.name}
              </h3>
              <p className="text-xs text-brand-600 font-medium uppercase tracking-wider">
                {user.title || user.role}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group ${
                activeTab === tab.id
                  ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-bold shadow-sm ring-1 ring-brand-100 dark:ring-transparent"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={!isSidebarOpen ? tab.label : ""}
            >
              <div
                className={`w-6 h-6 flex items-center justify-center text-lg transition-colors ${
                  activeTab === tab.id
                    ? "text-brand-600"
                    : "text-slate-400 group-hover:text-brand-600"
                }`}
              >
                <i className={`fas ${tab.icon}`}></i>
              </div>
              {isSidebarOpen && (
                <span className="whitespace-nowrap text-sm">{tab.label}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full p-2 text-slate-400 hover:text-brand-600 flex items-center justify-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
          >
            <i
              className={`fas ${
                isSidebarOpen ? "fa-chevron-left" : "fa-chevron-right"
              }`}
            ></i>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? "ml-72" : "ml-20"
        }`}
      >
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto min-h-[60vh]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h2>
                <p className="text-slate-500 text-sm">
                  Manage your activities and settings.
                </p>
              </div>
              <div className="flex gap-4">
                <button className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-brand-600 transition-colors relative">
                  <i className="fas fa-bell"></i>
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>
              </div>
            </div>

            {activeTab === "settings" ? (
              <ProfileSettingsForm user={user} />
            ) : (
              renderContent()
            )}
          </div>
        </div>

        <div className="mt-auto">
          <Footer />
        </div>
      </div>
    </div>
  );
};

// --- Landing Page, Hero, About etc... (Restoring previous components) ---

const Hero = ({
  onStart,
  onAuth,
}: {
  onStart: () => void;
  onAuth: () => void;
}) => (
  <section
    id="home"
    className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden scroll-mt-28"
  >
    <div className="absolute inset-0 bg-gradient-to-b from-brand-50 to-white dark:from-slate-900 dark:to-slate-800 -z-10"></div>
    <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-accent-400/10 rounded-full blur-3xl animate-float"></div>
    <div
      className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-brand-400/10 rounded-full blur-3xl animate-float"
      style={{ animationDelay: "2s" }}
    ></div>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
      <div className="text-center max-w-4xl mx-auto animate-slide-up">
        <div className="inline-block px-4 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold text-sm mb-6 border border-brand-200 dark:border-brand-700/50">
          🚀 Revolutionizing Education in Ethiopia
        </div>
        <h1 className="text-5xl lg:text-7xl font-display font-bold leading-tight mb-8 text-slate-900 dark:text-white">
          Unlock Your Potential with{" "}
          <span className="gradient-text">Ezana Academy</span>!
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          Master Web Development, Mathematics, and English with our expert-led,
          interactive courses. Join thousands of students achieving their
          dreams.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onAuth}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
          >
            Start Learning Now
          </button>
          <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
            <i className="fas fa-play-circle text-brand-600"></i> Watch Demo
          </button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-3xl mx-auto border-t border-slate-200 dark:border-slate-700 pt-8">
          {[
            { label: "Active Students", value: "5,000+" },
            { label: "Courses", value: "20+" },
            { label: "Instructors", value: "10+" },
          ].map((stat, idx) => (
            <AnimatedStat key={idx} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="py-20 bg-white dark:bg-slate-800">
    <div className="max-w-7xl mx-auto px-4">
      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            icon: "fa-laptop-code",
            title: "Practical Skills",
            desc: "Learn by doing with real-world projects and interactive coding environments.",
          },
          {
            icon: "fa-certificate",
            title: "Certified Learning",
            desc: "Earn recognized certificates upon completion to boost your resume.",
          },
          {
            icon: "fa-users",
            title: "Community Driven",
            desc: "Join a vibrant community of learners and mentors for 24/7 support.",
          },
        ].map((f, i) => (
          <div
            key={i}
            className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-700/50 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors group"
          >
            <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-brand-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
              <i className={`fas ${f.icon}`}></i>
            </div>
            <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">
              {f.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const About = () => {
  const ceoImage = DEFAULT_CEO_IMAGE; // Always use Kassahun.jpg for CEO image
  return (
    <section
      id="about"
      className="py-20 bg-slate-50 dark:bg-slate-900 scroll-mt-28"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center gap-16">
          <div className="w-full md:w-1/2 relative group">
            <img
              src={ceoImage}
              alt="CEO"
              className="relative rounded-3xl shadow-2xl w-full object-cover h-[500px]"
            />
            <div className="absolute bottom-6 left-6 right-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-4 rounded-xl shadow-lg">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                Kassahun Mulatu
              </h4>
              <p className="text-brand-600 text-sm">CEO & Founder</p>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-4xl font-display font-bold mb-6 text-slate-900 dark:text-white">
              Our Mission
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              Ezana Academy connects ambition with opportunity.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const ContactView = ({ onClose }: { onClose: () => void }) => {
  const [sent, setSent] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-20 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-lg w-full shadow-xl border border-slate-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="mb-6 text-slate-400 hover:text-brand-600 flex items-center gap-2 text-sm font-bold"
        >
          <i className="fas fa-arrow-left"></i> Back to Home
        </button>
        {sent ? (
          <div className="text-center py-10">
            <i className="fas fa-check-circle text-5xl text-green-500 mb-4"></i>
            <h3 className="text-xl font-bold dark:text-white">Message Sent!</h3>
            <p className="text-slate-500">We'll get back to you shortly.</p>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">
              Contact Us
            </h2>
            <p className="text-slate-500 mb-8">
              Have questions? We'd love to hear from you.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                required
                placeholder="Your Name"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <input
                required
                type="email"
                placeholder="Your Email"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <textarea
                required
                rows={4}
                placeholder="How can we help?"
                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white focus:ring-2 focus:ring-brand-500"
              ></textarea>
              <button
                type="submit"
                className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/30"
              >
                Send Message
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const AuthView = ({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: (user: User) => void;
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    let mockUser: User = {
      id: "u1",
      name: "John Doe",
      email,
      role: "student",
      joinDate: "2023-11-01",
      avatar: DEFAULT_AVATAR,
    };

    if (email.includes("admin"))
      mockUser = { ...mockUser, id: "adm1", name: "Admin User", role: "admin" };
    if (email.includes("instructor"))
      mockUser = {
        ...mockUser,
        id: "inst1",
        name: "Jane Instructor",
        role: "instructor",
        title: "Senior Developer",
      };

    onLogin(mockUser);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-20 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-xl border border-slate-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="mb-6 text-slate-400 hover:text-brand-600 flex items-center gap-2 text-sm font-bold"
        >
          <i className="fas fa-arrow-left"></i> Back to Home
        </button>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {isLogin ? "Welcome Back" : "Join Ezana"}
          </h2>
          <p className="text-slate-500">
            Access your personalized learning journey.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="password"
            required
            placeholder="Password"
            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none dark:text-white focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/30"
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Register"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-600 hover:underline font-medium"
          >
            {isLogin
              ? "Need an account? Sign up"
              : "Already have an account? Login"}
          </button>
        </div>
        <div className="mt-8 text-xs text-slate-400 text-center bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
          Use <b>admin@ezana.com</b> or <b>instructor@ezana.com</b> to test
          roles.
        </div>
      </div>
    </div>
  );
};

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "model"; text: string }[]
  >([
    {
      role: "model",
      text: "Hello, I'm Ezana AI! How can I help you learn today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch courses and general info to provide context to the AI
    DB.getCourses().then((courses) => {
      const courseInfo = courses
        .map(
          (c) =>
            `- ${c.title} (Price: ETB ${c.price}, Instructor: ${c.instructorName}): ${c.description}`
        )
        .join("\n");
      const generalInfo = `
            Ezana Academy General Info:
            - CEO & Founder: Kassahun Mulatu.
            - Location: Bahir Dar, Ethiopia.
            - Contact: +251 915508167, kmulatu21@gmail.com.
            - Mission: Empowering students across Ethiopia with world-class education in technology, mathematics, and languages.
            - Features: Practical Skills, Certified Learning, Community Driven.
            - Website Sections: Home, Courses, About, Contact.
            `;
      setContext(
        `You are Ezana AI, a helpful education assistant for Ezana Academy in Ethiopia. Use the following website information to answer user questions:\n${generalInfo}\n\nAvailable Courses:\n${courseInfo}\n\nIf the user asks about something else, try to be helpful but mention you are an education assistant.`
      );
    });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: input }]);
    const prompt = input;
    setInput("");
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          {
            role: "model",
            text: "API key not configured. Please set VITE_GOOGLE_AI_API_KEY in your .env file.",
          },
        ]);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });

      // Include the context in the prompt
      const fullPrompt = `${context}\n\nUser: ${prompt}\n\nAssistant:`;
      const response = await ai.models.generateContent({
        model: "models/gemini-pro",
        contents: [{ parts: [{ text: fullPrompt }] }],
      });
      setMessages((prev) => [
        ...prev,
        { role: "model", text: response.response.text() || "I'm not sure." },
      ]);
    } catch (e: any) {
      console.error("AI Error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `Connection error: ${
            e.message || "Please check your API configuration."
          }`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 bg-brand-600 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl animate-float hover:scale-110 transition-transform"
      >
        <i className={`fas ${isOpen ? "fa-times" : "fa-robot"}`}></i>
      </button>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[90] w-80 h-[500px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 animate-fade-in">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-brand-600 to-accent-600 text-white">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <i className="fas fa-robot"></i> Ezana AI Tutor
            </h3>
            <p className="text-xs text-brand-100 opacity-90">
              Ask me anything about our courses!
            </p>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-900">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-sm max-w-[85%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-brand-600 text-white ml-auto rounded-tr-none"
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm border border-slate-100 dark:border-slate-700 rounded-tl-none"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-400 pl-2">Thinking...</div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={handleSend}
            className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-sm outline-none dark:text-white border border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
              placeholder="Type a message..."
            />
            <button
              type="submit"
              className="w-10 h-10 bg-brand-600 rounded-full text-white flex items-center justify-center hover:bg-brand-700 transition-colors shadow-md"
            >
              <i className="fas fa-paper-plane text-xs"></i>
            </button>
          </form>
        </div>
      )}
    </>
  );
};

const getMockVideos = (category: string, image: string): Video[] => {
  const common = {
    thumbnail: image,
  };

  if (category === "web-dev")
    return [
      {
        id: "m1",
        title: "Introduction to Web Development",
        ...common,
        videoId: "zJSY8tbf_ys",
      },
      {
        id: "m2",
        title: "HTML5 & CSS3 Fundamentals",
        ...common,
        videoId: "mU6anWqZJcc",
      },
      {
        id: "m3",
        title: "JavaScript Crash Course",
        ...common,
        videoId: "hdI2bqOjy3c",
      },
      {
        id: "m4",
        title: "React JS Full Course",
        ...common,
        videoId: "w7ejDZ8SWv8",
      },
      {
        id: "m5",
        title: "Node.js Backend Basics",
        ...common,
        videoId: "Oe421EPjeBE",
      },
    ];
  if (category === "math")
    return [
      {
        id: "m1",
        title: "Algebra Introduction",
        ...common,
        videoId: "NybHckSEQBI",
      },
      {
        id: "m2",
        title: "Basic Calculus Explained",
        ...common,
        videoId: "WuP4H2n2iN0",
      },
      {
        id: "m3",
        title: "Trigonometry Basics",
        ...common,
        videoId: "Pub015_pyZY",
      },
      {
        id: "m4",
        title: "Geometry: Angles and Lines",
        ...common,
        videoId: "k5IM7xQ1W38",
      },
    ];
  // English
  return [
    {
      id: "m1",
      title: "Learn English Conversation",
      ...common,
      videoId: "NNamZGk7tn4",
    },
    { id: "m2", title: "Grammar: Tenses", ...common, videoId: "0WqC31Hw-7A" },
    { id: "m3", title: "Speaking Fluently", ...common, videoId: "JuKeQ3q45-E" },
    {
      id: "m4",
      title: "Vocabulary Building",
      ...common,
      videoId: "3yq48n2gZyk",
    },
  ];
};

const CourseDetail = ({
  course,
  onBack,
}: {
  course: Course;
  onBack: () => void;
}) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Listen for outside clicks to close the video
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (playingVideoId) {
        const container = document.getElementById(
          `video-frame-${playingVideoId}`
        );
        if (container && !container.contains(event.target as Node)) {
          setPlayingVideoId(null);
        }
      }
    };
    // Using mousedown for better response than click for "outside" detection
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [playingVideoId]);

  useEffect(() => {
    if (!course.phases?.[0]?.playlistId) {
      setVideos(getMockVideos(course.category, course.image));
      return;
    }

    const fetchVideos = async () => {
      setLoading(true);
      try {
        const pid = course.phases![0].playlistId;
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${pid}&key=${YOUTUBE_API_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) throw new Error(JSON.stringify(data.error));
        if (!data.items) throw new Error("No items in playlist");

        const validVideos = data.items
          .filter(
            (item: any) =>
              item.snippet &&
              item.snippet.title !== "Private video" &&
              item.snippet.title !== "Deleted video"
          )
          .map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            thumbnail:
              item.snippet.thumbnails?.medium?.url ||
              item.snippet.thumbnails?.default?.url ||
              "",
            videoId: item.snippet.resourceId.videoId,
          }));

        if (validVideos.length === 0) throw new Error("No valid videos found");
        setVideos(validVideos);
      } catch (err: any) {
        console.warn("YouTube API failed, utilizing fallback data:", err);
        setVideos(getMockVideos(course.category, course.image));
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [course]);

  return (
    <div className="animate-fade-in pb-20">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-slate-600 hover:text-brand-600 dark:text-slate-400"
      >
        <i className="fas fa-arrow-left"></i> Back
      </button>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl mb-8">
        <h1 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
          {course.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-300">
          {course.description}
        </p>
        <div className="flex gap-4 mt-6">
          <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full text-sm font-bold">
            {videos.length > 0 ? videos.length : "Multiple"} Lessons
          </span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-bold">
            {course.rating} ⭐
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-bold">
            ETB {course.price}
          </span>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">
        Course Content
      </h2>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div
                id={
                  playingVideoId === video.id
                    ? `video-frame-${video.id}`
                    : undefined
                }
                className="relative aspect-video"
              >
                {playingVideoId === video.id ? (
                  <div className="w-full h-full relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingVideoId(null);
                      }}
                      className="absolute top-2 right-2 z-20 w-8 h-8 bg-black/70 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors backdrop-blur-sm shadow-md"
                      title="Close Video"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                    <iframe
                      src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`}
                      title={video.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                ) : (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVideoId(video.id);
                    }}
                    className="w-full h-full relative cursor-pointer"
                  >
                    <img
                      src={video.thumbnail}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <i className="fas fa-play text-white ml-1"></i>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 mb-2">
                  {video.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fab fa-youtube text-red-500"></i>
                  <span>Video Lesson</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Courses = ({
  onCourseSelect,
  searchQuery,
}: {
  onCourseSelect: (c: Course) => void;
  searchQuery?: string;
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    DB.getCourses().then(setCourses);
  }, []);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  return (
    <section id="courses" className="py-20 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center text-slate-900 dark:text-white">
          Our Courses
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all flex flex-col h-full"
            >
              <div className="cursor-pointer" onClick={() => onCourseSelect(c)}>
                <img src={c.image} className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">
                    {c.title}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-4">
                    {c.description}
                  </p>
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-brand-600">ETB {c.price}</span>
                    <span className="text-slate-400">
                      {c.students} Students
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 pb-6 mt-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCourseSelect(c);
                  }}
                  className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Start Learning
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- Main App ---

type ViewState = "home" | "dashboard" | "course-detail" | "auth" | "contact";

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>("home");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Hash-based routing simplified for the requested structure
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === "#dashboard" && user) setView("dashboard");
      else if (hash === "#home" || hash === "") setView("home");
      // We can add hashes for auth/contact if desired, but state is sufficient for now
    };
    window.addEventListener("hashchange", handleHash);
    DB.getUser().then((u) => {
      setUser(u);
      if (window.location.hash === "#dashboard" && u) setView("dashboard");
    });

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      setDarkMode(true);
    }
    return () => window.removeEventListener("hashchange", handleHash);
  }, [user]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  const handleLogin = async (u: User) => {
    await DB.setUser(u);
    setUser(u);
    setView("dashboard");
    window.location.hash = "dashboard";
  };

  const handleLogout = async () => {
    await DB.logout();
    setUser(null);
    setView("home");
    window.location.hash = "home";
  };

  const handleNavClick = (sectionId: string) => {
    setView("home");
    setSelectedCourse(null);
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleCourseSelect = (c: Course) => {
    setSelectedCourse(c);
    setView("course-detail");
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "dark" : ""}`}>
      <Navbar
        user={user}
        onLoginClick={() => setView("auth")}
        onLogout={handleLogout}
        onContactClick={() => setView("contact")}
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
        onSearch={setSearchQuery}
        onNavClick={handleNavClick}
        alwaysSolid={view !== "home"}
      />

      {/* Content Rendering based on View State */}
      {view === "dashboard" && user ? (
        <Dashboard user={user} setSelectedCourse={handleCourseSelect} />
      ) : view === "auth" ? (
        <AuthView onClose={() => setView("home")} onLogin={handleLogin} />
      ) : view === "contact" ? (
        <ContactView onClose={() => setView("home")} />
      ) : view === "course-detail" && selectedCourse ? (
        <>
          <div className="pt-28 max-w-7xl mx-auto px-4 flex-1 w-full">
            <CourseDetail
              course={selectedCourse}
              onBack={() => {
                setSelectedCourse(null);
                setView("home");
              }}
            />
          </div>
          <Footer />
        </>
      ) : (
        <>
          <main className="flex-1">
            <Hero
              onStart={() => {
                if (user) {
                  setView("dashboard");
                  window.location.hash = "dashboard";
                } else {
                  setView("auth");
                }
              }}
              onAuth={() => setView("auth")}
            />
            <Features />
            <Courses
              onCourseSelect={handleCourseSelect}
              searchQuery={searchQuery}
            />
            <About />
          </main>
          <Footer />
        </>
      )}

      <AIAssistant />
    </div>
  );
};

export default App;

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
