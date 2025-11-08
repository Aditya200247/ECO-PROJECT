import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  increment,
  writeBatch
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion'; // Added Framer Motion
import { 
  CheckCircle, 
  MapPin, 
  Navigation, 
  Search, 
  X, 
  Award, 
  User, 
  Settings, 
  Star, 
  Send, 
  Clock, 
  Droplet, 
  Wind, 
  Zap, 
  Fuel, 
  Leaf, 
  Bus, 
  Car, 
  Plus, 
  ChevronRight, 
  ArrowLeft,
  Info,
  DollarSign,
  AlertTriangle,
  Smile,
  Frown,
  Edit,
  Footprints,
  CloudCog,
  Trophy,
  BarChart2,
  Share2,
  ArrowRight
} from 'lucide-react';

/* --- Firebase Configuration --- */
// These will be provided by the environment
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "YOUR_FALLBACK_API_KEY", authDomain: "YOUR_FALLBACK_AUTH_DOMAIN", projectId: "YOUR_FALLBACK_PROJECT_ID" };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- App Context ---
// We use context to pass user, auth, and db to all components
const AppContext = createContext(null);

/* --- Mock API (Bangalore Focused) --- */
// Simulates fetching route data from your complex AI backend
const fetchMockRoutes = (from, to) => {
  console.log(`Fetching mock routes from ${from} to ${to}`);
  
  // Helper to add realistic variance
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max));

  return new Promise((resolve) => {
    setTimeout(() => {
      const routes = [
        {
          id: 'route_eco',
          name: 'Eco-Friendly Route',
          icon: Leaf,
          color: 'text-green-500',
          time: randInt(35, 42), // minutes
          distance: parseFloat(rand(10.0, 11.0).toFixed(1)), // km
          carbon: parseFloat(rand(1.8, 2.2).toFixed(1)), // kg CO2
          aqi: randInt(70, 85), // Moderate
          evStations: 5,
          petrolPumps: 3,
          toll: false,
          construction: 'Minor roadwork near Domlur.',
          healthImpact: 'Moderate pollution. Good for most.',
          speedAdvice: 'Maintain 30-40 km/h for best fuel economy.',
          cabFare: randInt(180, 220),
          points: 20
        },
        {
          id: 'route_fast',
          name: 'Fastest Route (Toll)',
          icon: Clock,
          color: 'text-blue-500',
          time: randInt(25, 30), // minutes
          distance: parseFloat(rand(12.5, 13.0).toFixed(1)), // km
          carbon: parseFloat(rand(3.1, 3.5).toFixed(1)), // kg CO2
          aqi: randInt(90, 110), // Unhealthy for Sensitive
          evStations: 2,
          petrolPumps: 4,
          toll: true,
          tollCost: 45, // ₹45
          construction: null,
          healthImpact: 'Higher pollution. Keep windows up if sensitive.',
          speedAdvice: 'Follow posted speed limits (50-60 km/h) for best time.',
          cabFare: randInt(240, 280),
          points: 5
        },
        {
          id: 'route_special',
          name: 'Special Hybrid Route',
          icon: Bus,
          color: 'text-purple-500',
          time: randInt(30, 35), // minutes
          distance: parseFloat(rand(11.8, 12.5).toFixed(1)), // km (total)
          carbon: parseFloat(rand(1.0, 1.3).toFixed(1)), // kg CO2
          aqi: randInt(75, 85), // Moderate
          evStations: 1, // at parking
          petrolPumps: 1,
          toll: false,
          construction: null,
          healthImpact: 'Low pollution, involves walking.',
          speedAdvice: 'Drive 6km to Metro, then 15 min ride.',
          specialInfo: 'Drive 6 km to Indiranagar Metro. Park vehicle (Est. parking ₹50). Take Purple Line (15 min). Walk 2 min to destination.',
          cabFare: null,
          points: 30
        }
      ];
      resolve(routes);
    }, 1500);
  });
};

/* --- Firestore Hooks & Functions --- */

// Hook to listen to user's profile data (e.g., points)
const useUserProfile = (userId) => {
  const [profile, setProfile] = useState({ points: 0, name: 'Eco Warrior' });

  useEffect(() => {
    if (!userId) return;
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
    
    // Ensure the doc exists
    getDoc(userDocRef).then(docSnap => {
      if (!docSnap.exists()) {
        setDoc(userDocRef, { points: 0, name: 'Eco Warrior' }, { merge: true });
      }
    });

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      } else {
        setProfile({ points: 0, name: 'Eco Warrior' });
      }
    });

    return () => unsubscribe();
  }, [userId]);

  return profile;
};

// Hook to listen to a user's collection (e.g., garage)
const useUserCollection = (userId, collectionName) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const collectionRef = collection(db, `artifacts/${appId}/users/${userId}/${collectionName}`);
    const q = query(collectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const collectionData = [];
      querySnapshot.forEach((doc) => {
        collectionData.push({ id: doc.id, ...doc.data() });
      });
      setItems(collectionData);
    });

    return () => unsubscribe();
  }, [userId, collectionName]);

  return items;
};

// Hook to listen to a public collection (e.g., leaderboard)
const usePublicCollection = (collectionName) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const collectionRef = collection(db, `artifacts/${appId}/public/data/${collectionName}`);
    // Note: orderBy is tricky without indexes. We'll sort in JS.
    const q = query(collectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const collectionData = [];
      querySnapshot.forEach((doc) => {
        collectionData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by points descending, limit to top 10
      const sortedData = collectionData
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, 10);
      setItems(sortedData);
    });

    return () => unsubscribe();
  }, [collectionName]);

  return items;
};

// Function to add points and update leaderboard
const awardPoints = async (userId, pointsToAdd, reason) => {
  if (!userId || !pointsToAdd) return;
  
  console.log(`Awarding ${pointsToAdd} points to ${userId} for ${reason}`);
  try {
    const batch = writeBatch(db);

    // 1. Increment user's personal points
    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
    batch.set(userProfileRef, { points: increment(pointsToAdd) }, { merge: true });

    // 2. Add to leaderboard (public collection)
    // We use userId as doc ID to prevent duplicates
    const leaderboardRef = doc(db, `artifacts/${appId}/public/data/leaderboard`, userId);
    batch.set(leaderboardRef, { 
      points: increment(pointsToAdd), 
      userId: userId // Store userId for display
    }, { merge: true });
    
    // 3. Log the transaction (optional, but good practice)
    const logRef = collection(db, `artifacts/${appId}/users/${userId}/point_logs`);
    addDoc(logRef, { // Note: addDoc is not transactional with batch, but set/update are.
      points: pointsToAdd,
      reason: reason,
      timestamp: new Date()
    }); // This will run separately. For true atomicity, you'd use a transaction or cloud function.

    await batch.commit();
    console.log("Points awarded and leaderboard updated.");
  } catch (error) {
    console.error("Error awarding points: ", error);
  }
};

// Function to add a car to the user's garage
const addCarToGarage = async (userId, carData) => {
  if (!userId || !carData) return;
  try {
    const garageRef = collection(db, `artifacts/${appId}/users/${userId}/garage`);
    await addDoc(garageRef, { ...carData, createdAt: new Date() });
    console.log("Car added to garage.");
  } catch (error) {
    console.error("Error adding car: ", error);
  }
};

// Function to submit feedback
const submitUserFeedback = async (userId, feedbackData) => {
  if (!userId || !feedbackData) return;
  try {
    const feedbackRef = collection(db, `artifacts/${appId}/public/data/feedback`);
    await addDoc(feedbackRef, { 
      ...feedbackData, 
      userId: userId, 
      timestamp: new Date() 
    });
    console.log("Feedback submitted.");
    // Award points for feedback
    await awardPoints(userId, 10, 'Submitting feedback');
  } catch (error) {
    console.error("Error submitting feedback: ", error);
  }
};

/* --- UI Components --- */

// Modal Component
const Modal = ({ children, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 text-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end p-2">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6 pt-0 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// Animated Bar Chart for Stats (Point 9)
const StatsGraph = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  const barVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: (custom) => ({
      height: custom.height,
      opacity: 1,
      transition: {
        delay: custom.index * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    })
  };

  return (
    <div className="w-full bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Area Pollution Stats (AQI)</h3>
      <div className="flex justify-around items-end h-32 space-x-2">
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <motion.div 
              className="w-full bg-blue-500 rounded-t-md"
              style={{
                background: item.color || 'linear-gradient(to top, #3b82f6, #60a5fa)'
              }}
              variants={barVariants}
              initial="hidden"
              animate="visible"
              custom={{ height: `${(item.value / maxValue) * 100}%`, index }}
            >
            </motion.div>
            <span className="text-xs text-gray-400 mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// AI Tip Component (Point 10)
const AiTip = () => {
  const [tip, setTip] = useState('');
  const tips = [
    "Did you know? Walking or cycling for trips under 1km can reduce your carbon footprint significantly!",
    "Properly inflated tires can improve your gas mileage by up to 3%. Check yours today!",
    "Combining errands into one trip saves you time, fuel, and reduces emissions.",
    "Consider using public transport during peak hours. It's often faster and much more eco-friendly."
  ];

  useEffect(() => {
    // Pick a random tip
    setTip(tips[Math.floor(Math.random() * tips.length)]);
  }, []);

  return (
    <motion.div 
      className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-lg flex items-center space-x-3 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <CloudCog size={40} className="text-white flex-shrink-0" />
      <div>
        <h4 className="font-semibold text-white">AI Eco-Tip</h4>
        <p className="text-white/90 text-sm">{tip}</p>
      </div>
    </motion.div>
  );
};

// Car Selector / Garage Component (Point 16)
const CarSelectorModal = ({ isOpen, onClose }) => {
  const { userId } = useContext(AppContext);
  const garage = useUserCollection(userId, 'garage');
  
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuelType, setFuelType] = useState('Petrol');
  const [carbon, setCarbon] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addCarToGarage(userId, { model, year, mileage, fuelType, carbon });
    setModel('');
    setYear('');
    setMileage('');
    setFuelType('Petrol');
    setCarbon('');
  };
  
  // This is where the AI logic would go (Point 16)
  const getBestCarForTrip = (distance) => {
    if (garage.length === 0) return null;
    // Mock logic: Assume lower carbon is always better
    const sortedCars = [...garage].sort((a, b) => (a.carbon || 150) - (b.carbon || 150));
    return sortedCars[0];
  };

  const bestCar = getBestCarForTrip(15); // Mock distance of 15km

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-2xl font-bold mb-4">My Garage & Car Selector</h2>
      
      {bestCar && (
        <div className="bg-green-800/50 border border-green-600 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-lg text-green-300">AI Suggestion</h3>
          <p>For a typical 15km trip, your <strong>{bestCar.model}</strong> is the most eco-friendly choice!</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-3">Your Vehicles</h3>
        {garage.length === 0 ? (
          <p className="text-gray-400">Your garage is empty. Add a vehicle below.</p>
        ) : (
          <motion.div className="space-y-3" initial="hidden" animate="visible" variants={{
            visible: { transition: { staggerChildren: 0.05 } }
          }}>
            {garage.map(car => (
              <motion.div 
                key={car.id} 
                className="bg-gray-800 p-3 rounded-lg flex items-center justify-between"
                variants={{
                  hidden: { opacity: 0, x: -20 },
                  visible: { opacity: 1, x: 0 }
                }}
              >
                <div className="flex items-center space-x-3">
                  <Car size={24} className="text-blue-400" />
                  <div>
                    <p className="font-semibold">{car.model} ({car.year})</p>
                    <p className="text-sm text-gray-400">{car.fuelType} - {car.mileage} km/l - {car.carbon} g/km CO2</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-xl font-semibold">Add New Vehicle</h3>
        <input 
          type="text" 
          placeholder="Vehicle Model (e.g., Tata Nexon EV)" 
          value={model}
          onChange={e => setModel(e.target.value)}
          className="w-full p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <div className="flex space-x-4">
          <input 
            type="number" 
            placeholder="Year" 
            value={year}
            onChange={e => setYear(e.target.value)}
            className="w-1/2 p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input 
            type="number" 
            placeholder="Mileage (km/l)" 
            value={mileage}
            onChange={e => setMileage(e.target.value)}
            className="w-1/2 p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex space-x-4">
           <select 
             value={fuelType} 
             onChange={e => setFuelType(e.target.value)}
             className="w-1/2 p-3 bg-gray-800 rounded-lg text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
           >
            <option>Petrol</option>
            <option>Diesel</option>
            <option>Electric</option>
            <option>Hybrid</option>
            <option>CNG</option>
          </select>
          <input 
            type="number" 
            placeholder="Carbon (g/km)" 
            value={carbon}
            onChange={e => setCarbon(e.target.value)}
            className="w-1/2 p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <motion.button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Add Vehicle
        </motion.button>
      </form>
    </Modal>
  );
};

// Leaderboard Modal (Point 22)
const LeaderboardModal = ({ isOpen, onClose }) => {
  const leaderboard = usePublicCollection('leaderboard');

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center space-x-3 mb-6">
        <Trophy size={32} className="text-yellow-400" />
        <h2 className="text-3xl font-bold">Eco Leaderboard</h2>
      </div>
      <motion.div 
        className="space-y-3"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        {leaderboard.map((user, index) => (
          <motion.div 
            key={user.id} 
            className="flex items-center bg-gray-800 p-4 rounded-lg"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <span className={`font-bold text-lg w-8 ${
              index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-yellow-700' : ''
            }`}>
              {index + 1}
            </span>
            <User size={20} className="mx-3" />
            <span className="flex-1 text-sm truncate">User: ...{user.userId.slice(-6)}</span>
            <span className="font-bold text-green-400">{user.points} pts</span>
          </motion.div>
        ))}
      </motion.div>
    </Modal>
  );
};

// Saved Routes Component (Point 11)
const SavedRoutes = ({ onSelectRoute }) => {
  const { userId } = useContext(AppContext);
  // We'll mock this for now, but it would use useUserCollection
  const saved = [
    { from: 'Home (Jayanagar)', to: 'Work (Whitefield)' },
    { from: 'Home (Jayanagar)', to: 'Gym (Koramangala)' }
  ];
  
  // This would be a real dashboard (Point 11)
  const openRouteDashboard = (route) => {
     // Replaced alert with console.log
     console.log(`Opening dashboard for ${route.from} -> ${route.to}\n\nHere you would see graphs, cab fares, and eco-stats!`);
  };

  return (
    <div className="mb-4">
      <h3 className="text-xl font-semibold mb-3 px-4">Saved Routes</h3>
      <div className="px-4 space-y-3">
        {saved.map((route, i) => (
          <motion.div 
            key={i} 
            className="bg-gray-800 p-3 rounded-lg flex items-center justify-between"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div>
              <p className="font-semibold">{route.from} <ArrowRight size={14} className="inline" /> {route.to}</p>
            </div>
            <div className="flex space-x-2">
              <motion.button 
                onClick={() => onSelectRoute(route.from, route.to)}
                className="p-2 bg-blue-600 rounded-full hover:bg-blue-700"
                title="Navigate this route"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Navigation size={16} />
              </motion.button>
               <motion.button 
                onClick={() => openRouteDashboard(route)}
                className="p-2 bg-gray-700 rounded-full hover:bg-gray-600"
                title="View Dashboard"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <BarChart2 size={16} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Nearby Stations (Point 15)
const NearbyStations = () => {
  return (
    <div className="px-4">
       <h3 className="text-xl font-semibold mb-3">Nearby Stations</h3>
       <div className="flex space-x-3">
        <motion.div 
          className="flex-1 bg-gray-800 p-3 rounded-lg flex items-center space-x-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Zap size={20} className="text-yellow-400" />
          <div>
            <p className="font-semibold">Ather Grid</p>
            <p className="text-sm text-gray-400">1.2 km away</p>
          </div>
        </motion.div>
        <motion.div 
          className="flex-1 bg-gray-800 p-3 rounded-lg flex items-center space-x-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Fuel size={20} className="text-red-400" />
          <div>
            <p className="font-semibold">Indian Oil</p>
            <p className="text-sm text-gray-400">0.6 km away</p>
          </div>
        </motion.div>
       </div>
    </div>
  );
};

// User Feedback Modal (Points 12 & 13)
const FeedbackModal = ({ isOpen, onClose, routeId }) => {
  const { userId } = useContext(AppContext);
  const [rating, setRating] = useState(0);
  const [complaint, setComplaint] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitUserFeedback(userId, {
      type: 'RouteFeedback',
      routeId: routeId || 'general',
      rating: rating,
      complaint: complaint,
    });
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
      setRating(0);
      setComplaint('');
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {!isSubmitted ? (
        <form onSubmit={handleSubmit}>
          <h2 className="text-2xl font-bold mb-4">Report an Issue / Rate Route</h2>
          <p className="text-gray-400 mb-4">
            (Point 12 & 13) Did the trip take longer? Was there a problem? Let us know!
          </p>
          
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Rate this Route (out of 5)</h3>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map(star => (
                <Star 
                  key={star} 
                  size={32} 
                  className={`cursor-pointer ${rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                  fill={rating >= star ? 'currentColor' : 'none'}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Report a problem (optional)</h3>
            <textarea
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              rows="4"
              className="w-full p-3 bg-gray-800 rounded-lg text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., The app said 20 mins, but it took 35 due to unlisted construction..."
            />
          </div>
          
          <motion.button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Submit Feedback (10 points)
          </motion.button>
        </form>
      ) : (
        <div className="text-center p-8">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Thank You!</h2>
          <p className="text-lg text-gray-300">Your feedback helps improve our AI.</p>
          <p className="text-xl font-bold text-green-400 mt-2">+10 Points Awarded!</p>
        </div>
      )}
    </Modal>
  );
};


/* --- Main Screens --- */

// 1. Home Screen
const HomeScreen = ({ onSearch }) => {
  const [from, setFrom] = useState('Koramangala, Bengaluru'); // Mock
  const [to, setTo] = useState('Indiranagar, Bengaluru'); // Mock
  const { userId } = useContext(AppContext);

  const handleSearch = () => {
    if (from && to) {
      onSearch(from, to);
    }
  };
  
  const handleSelectSaved = (from, to) => {
    setFrom(from);
    setTo(to);
    onSearch(from, to);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 1. Map Placeholder */}
      <div className="flex-1 bg-gray-700 flex items-center justify-center text-gray-500 relative">
        <MapPin size={64} />
        <span className="absolute top-4 left-4 text-sm bg-black/50 text-white p-2 rounded-lg">
          Map simulation. Location: Bengaluru
        </span>
        <div className="absolute top-4 right-4 text-sm bg-black/50 text-white p-2 rounded-lg font-mono text-xs">
          UserID: {userId ? `...${userId.slice(-6)}` : '...'}
        </div>
      </div>

      {/* 2. Bottom Sheet */}
      <div className="bg-gray-900 rounded-t-2xl shadow-2xl p-4 pt-6 max-h-[60vh] overflow-y-auto">
        <div className="px-4 mb-4">
          {/* Search Inputs */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <input 
                type="text" 
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full p-4 pl-12 bg-gray-800 rounded-lg text-white border border-gray-700"
                placeholder="From: Current Location"
              />
              <MapPin size={20} className="absolute left-4 top-4.5 text-blue-400" />
            </div>
             <div className="relative">
              <input 
                type="text" 
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full p-4 pl-12 bg-gray-800 rounded-lg text-white border border-gray-700"
                placeholder="To: Where are you going?"
              />
              <Navigation size={20} className="absolute left-4 top-4.5 text-green-400" />
            </div>
          </div>
          {/* Search Button */}
          <motion.button 
            onClick={handleSearch}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold py-4 px-4 rounded-lg flex items-center justify-center space-x-2 text-lg hover:from-blue-600 hover:to-blue-700 transition duration-200 shadow-lg"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Search size={24} />
            <span>Find Eco Routes</span>
          </motion.button>
        </div>
        
        {/* Saved Routes (Point 11) */}
        <SavedRoutes onSelectRoute={handleSelectSaved} />

        {/* Nearby Stations (Point 15) */}
        <NearbyStations />

      </div>
    </div>
  );
};

// 2. Route Selection Screen
const RouteSelectionScreen = ({ from, to, onSelectRoute, onBack }) => {
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWalkNudge, setShowWalkNudge] = useState(false);

  useEffect(() => {
    fetchMockRoutes(from, to).then(data => {
      setRoutes(data);
      setIsLoading(false);
      
      // Nudge for walking (Point 15)
      // Mock logic: if any route is < 1.5km
      if (data.some(r => r.distance < 1.5)) {
        setShowWalkNudge(true);
      }
    });
  }, [from, to]);

  const RouteCard = ({ route }) => (
    <motion.div 
      onClick={() => onSelectRoute(route)}
      className="bg-gray-800 rounded-xl p-4 shadow-lg cursor-pointer border-2 border-transparent hover:border-blue-500 transition duration-200"
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-center mb-2">
        <div className={`flex items-center space-x-2 ${route.color}`}>
          <route.icon size={24} />
          <h3 className="text-xl font-bold">{route.name}</h3>
        </div>
        <ChevronRight size={24} className="text-gray-500" />
      </div>
      
      <div className="flex justify-around text-center my-4">
        <div>
          <p className="text-2xl font-bold">{route.time}</p>
          <p className="text-sm text-gray-400">min</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{route.distance}</p>
          <p className="text-sm text-gray-400">km</p>
        </div>
         <div>
          <p className="text-2xl font-bold">{route.carbon}</p>
          <p className="text-sm text-gray-400">kg CO2</p>
        </div>
        <div>
          <p className={`text-2xl font-bold ${route.aqi < 50 ? 'text-green-400' : route.aqi < 100 ? 'text-yellow-400' : 'text-orange-400'}`}>
            {route.aqi}
          </p>
          <p className="text-sm text-gray-400">AQI</p>
        </div>
      </div>
      
      {/* Tags */}
      <div className="flex flex-wrap gap-2 text-xs">
        {route.toll && (
          <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded-full flex items-center space-x-1">
            <span className="font-bold">₹</span>
            <span>Toll Route: ₹{route.tollCost.toFixed(0)}</span>
          </span>
        )}
        {route.construction && (
          <span className="bg-yellow-900/50 text-yellow-300 px-2 py-1 rounded-full flex items-center space-x-1">
            <AlertTriangle size={12} />
            <span>Construction</span>
          </span>
        )}
        <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded-full">
          +{route.points} Eco Points
        </span>
      </div>
    </motion.div>
  );

  return (
    <div className="p-4 pt-6 flex flex-col h-full">
      <div className="flex items-center mb-4">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-300">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm text-gray-400">Your Route</p>
          <h2 className="text-lg font-semibold truncate">
            {from} to {to}
          </h2>
        </div>
        <div className="w-8"></div> {/* Spacer */}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <CloudCog size={64} className="text-blue-500 animate-pulse" />
          <p className="text-lg mt-4">Finding the best eco-routes...</p>
          <p className="text-gray-400">Analyzing traffic, emissions, and AQI</p>
        </div>
      ) : (
        <motion.div 
          className="flex-1 overflow-y-auto space-y-4"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
        >
          {showWalkNudge && (
            <motion.div 
              className="bg-green-800/50 border border-green-600 p-4 rounded-lg flex items-center space-x-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Footprints size={32} className="text-green-300" />
              <div>
                <h4 className="font-semibold text-white">(Point 15) Friendly Nudge!</h4>
                <p className="text-green-200 text-sm">This distance is under 1.5km. Consider walking to earn <strong>100 Eco Points</strong>!</p>
              </div>
            </motion.div>
          )}
          {routes.map(route => (
            <RouteCard key={route.id} route={route} />
          ))}
        </motion.div>
      )}
    </div>
  );
};

// 3. Route Details & Navigation Screen
const RouteDetailsScreen = ({ route, onBack }) => {
  const { userId } = useContext(AppContext);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const mockGraphData = [
    { label: 'Area 1', value: route.aqi - 15 > 0 ? route.aqi - 15 : 10, color: '#4ade80' },
    { label: 'Area 2', value: route.aqi, color: '#facc15' },
    { label: 'Area 3', value: route.aqi - 10 > 0 ? route.aqi - 10 : 12, color: '#60a5fa' },
    { label: 'Area 4', value: route.aqi + 20, color: '#f87171' },
  ];
  
  const handleStartRoute = async () => {
    // Award points for starting eco route
    if (route.points > 10) {
      await awardPoints(userId, route.points, `Started ${route.name}`);
    }
    // Replaced alert with console.log
    console.log(`(Simulation) Starting navigation for: ${route.name}\n\nYou've been awarded ${route.points} points!`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 1. Map Placeholder */}
      <div className="h-1/3 bg-gray-700 flex items-center justify-center text-gray-500 relative">
        <Navigation size={64} />
        <span className="absolute top-4 left-4 text-sm bg-black/50 text-white p-2 rounded-lg">
          Simulating route: {route.name}
        </span>
        <button 
          onClick={onBack} 
          className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white"
        >
          <ArrowLeft size={24} />
        </button>
      </div>
      
      {/* 2. Details Sheet */}
      <motion.div 
        className="flex-1 bg-gray-900 rounded-t-2xl p-4 overflow-y-auto space-y-4"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
      >
        <h2 className={`text-2xl font-bold ${route.color}`}>{route.name}</h2>
        <div className="flex justify-around text-center py-2">
          <div>
            <p className="text-3xl font-bold">{route.time}</p>
            <p className="text-sm text-gray-400">min</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{route.distance}</p>
            <p className="text-sm text-gray-400">km</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{route.carbon}</p>
            <p className="text-sm text-gray-400">kg CO2</p>
          </div>
        </div>

        {/* Special Route Info (Point 17) */}
        {route.specialInfo && (
          <div className="bg-purple-800/50 border border-purple-600 p-4 rounded-lg">
            <h4 className="font-semibold text-lg text-purple-300 flex items-center space-x-2">
              <Bus size={20} />
              <span>Hybrid Route Details</span>
            </h4>
            <p className="text-purple-200">{route.specialInfo}</p>
          </div>
        )}

        {/* Health & Warnings (Points 19, 20, 21) */}
        <div className="bg-gray-800 p-4 rounded-lg space-y-3">
          <h4 className="text-lg font-semibold">Route Intel</h4>
          <p className="flex items-start space-x-2">
            <Wind size={20} className="text-blue-400 mt-0.5" />
            <span><strong>Health (AQI):</strong> {route.healthImpact}</span>
          </p>
          <p className="flex items-start space-x-2">
            <Info size={20} className="text-blue-400 mt-0.5" />
            <span><strong>Speed Advice (Point 18):</strong> {route.speedAdvice}</span>
          </p>
          {route.toll && (
             <p className="flex items-start space-x-2">
              <span className="font-bold text-red-400 mt-0.5">₹</span>
              <span><strong>Toll Route:</strong> Costs approx ₹{route.tollCost.toFixed(0)}.</span>
            </p>
          )}
          {route.construction && (
             <p className="flex items-start space-x-2">
              <AlertTriangle size={20} className="text-yellow-400 mt-0.5" />
              <span><strong>Construction:</strong> {route.construction}</span>
            </p>
          )}
        </div>
        
        {/* Animated Graph (Point 9) */}
        <StatsGraph data={mockGraphData} />
        
        {/* AI Tip (Point 10) */}
        <AiTip />
        
        {/* Feedback (Points 12, 13) */}
        <button 
          onClick={() => setIsFeedbackModalOpen(true)}
          className="w-full text-center p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300"
        >
          Wrong time? Bad route? Tap here to report or rate.
        </button>

        {/* Start Button */}
        <motion.button 
          onClick={handleStartRoute}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 px-4 rounded-lg flex items-center justify-center space-x-2 text-lg hover:from-green-600 hover:to-green-700 transition duration-200 shadow-lg"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Navigation size={24} />
          <span>Start Route (+{route.points} Points)</span>
        </motion.button>
      </motion.div>
      
      <FeedbackModal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => setIsFeedbackModalOpen(false)} 
        routeId={route.id}
      />
    </div>
  );
};

// 4. Profile Screen (Point 22)
const ProfileScreen = () => {
  const { userId } = useContext(AppContext);
  const profile = useUserProfile(userId);
  const [isCarModalOpen, setIsCarModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);
  
  const shareProgress = () => {
    // In a real app, this would use navigator.share
    // Replaced alert with console.log
    console.log(`(Simulation) Sharing my progress!\n\nI have ${profile.points} Eco Points on EcoRoutes!\n\n(UserID: ...${userId.slice(-6)})`);
  };

  return (
    <div className="p-4 pt-10">
      <div className="flex items-center space-x-4 mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <User size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{profile.name}</h2>
          <p className="text-sm text-gray-400 truncate">UserID: {userId}</p>
        </div>
      </div>
      
      {/* Points Dashboard */}
      <div className="bg-gray-800 p-6 rounded-2xl mb-6 text-center shadow-lg">
        <p className="text-sm text-gray-400">Total Eco Points</p>
        <p className="text-5xl font-bold text-green-400 my-2">{profile.points}</p>
        <p className="text-gray-300">You're doing great! <strong>{1000 - (profile.points % 1000)}</strong> points to your next reward!</p>
      </div>

      {/* Actions */}
      <motion.div 
        className="space-y-3"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } }
        }}
      >
        <motion.button 
          onClick={() => setIsLeaderboardModalOpen(true)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-5 rounded-lg flex items-center justify-between transition duration-200"
          variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center space-x-3">
            <Trophy size={20} className="text-yellow-400" />
            <span>View Leaderboard</span>
          </div>
          <ChevronRight size={20} />
        </motion.button>
        
        <motion.button 
          onClick={() => setIsCarModalOpen(true)}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-5 rounded-lg flex items-center justify-between transition duration-200"
          variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center space-x-3">
            <Car size={20} className="text-blue-400" />
            <span>My Garage / Car Selector</span>
          </div>
          <ChevronRight size={20} />
        </motion.button>
        
        <motion.button 
          onClick={shareProgress}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-5 rounded-lg flex items-center justify-between transition duration-200"
          variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center space-x-3">
            <Share2 size={20} className="text-green-400" />
            <span>Share My Eco Progress</span>
          </div>
          <ChevronRight size={20} />
        </motion.button>
      </motion.div>
      
      {/* Modals */}
      <CarSelectorModal 
        isOpen={isCarModalOpen}
        onClose={() => setIsCarModalOpen(false)}
      />
      <LeaderboardModal 
        isOpen={isLeaderboardModalOpen}
        onClose={() => setIsLeaderboardModalOpen(false)}
      />
    </div>
  );
};


/* --- Main App Component --- */
export default function App() {
  const [view, setView] = useState('home'); // home, routes, details, profile
  const [routeParams, setRouteParams] = useState(null); // { from, to }
  const [selectedRoute, setSelectedRoute] = useState(null);
  
  // Auth state
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Animation variants for page transitions
  const pageVariants = {
    initial: {
      opacity: 0,
      x: "-100vw",
      scale: 0.8
    },
    in: {
      opacity: 1,
      x: 0,
      scale: 1
    },
    out: {
      opacity: 0,
      x: "100vw",
      scale: 1.2
    }
  };

  const pageTransitions = {
    type: "tween",
    ease: "anticipate",
    duration: 0.5
  };

  // Auth setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) {
          console.log("Attempting to sign in with custom token...");
          await signInWithCustomToken(auth, token);
          console.log("Signed in with custom token.");
        } else {
          console.log("No custom token, signing in anonymously...");
          await signInAnonymously(auth);
          console.log("Signed in anonymously.");
        }
      } catch (error) {
        console.error("Error signing in: ", error);
        // Fallback to anonymous
        if (error.code !== 'auth/custom-token-mismatch' && auth.currentUser == null) {
           console.log("Sign-in error, falling back to anonymous...");
           await signInAnonymously(auth);
           console.log("Signed in anonymously after error.");
        } else {
          console.log("User is already signed in or error is token mismatch.");
        }
      }
    };
    
    // Set Firestore log level for debugging
    // setLogLevel('debug'); // Uncomment this for verbose Firestore logs
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Auth state changed, user ID:", user.uid);
        setUserId(user.uid);
      } else {
        console.log("Auth state changed, no user.");
        setUserId(null);
      }
      setIsAuthReady(true);
      console.log("Auth is ready.");
    });

    return () => unsubscribe();
  }, []);

  // Handlers
  const handleSearch = (from, to) => {
    setRouteParams({ from, to });
    setView('routes');
  };
  
  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    setView('details');
  };

  const handleBack = () => {
    if (view === 'details') {
      setView('routes');
    } else if (view === 'routes') {
      setView('home');
    }
  };

  // Render logic
  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomeScreen onSearch={handleSearch} />;
      case 'routes':
        return <RouteSelectionScreen 
                  from={routeParams.from} 
                  to={routeParams.to} 
                  onSelectRoute={handleSelectRoute}
                  onBack={handleBack}
                />;
      case 'details':
        return <RouteDetailsScreen 
                  route={selectedRoute}
                  onBack={handleBack}
                />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen onSearch={handleSearch} />;
    }
  };
  
  if (!isAuthReady) {
    return (
      <div className="bg-gray-900 text-white h-screen flex flex-col items-center justify-center">
        <CloudCog size={64} className="text-blue-500 animate-spin" />
        <p className="text-lg mt-4">Connecting to EcoNet...</p>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ userId, auth, db }}>
      <div className="h-screen w-full bg-gray-900 text-white font-sans flex flex-col overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative">
           <AnimatePresence mode="wait">
            <motion.div
              key={view}
              className="absolute w-full h-full"
              initial="initial"
              animate="in"
              exit="out"
              variants={pageVariants}
              transition={pageTransitions}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-gray-950 p-3 shadow-2xl border-t border-gray-700 flex justify-around">
          <button 
            onClick={() => setView('home')} 
            className={`flex flex-col items-center w-full p-2 rounded-lg ${view === 'home' || view === 'routes' || view === 'details' ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <Navigation size={24} />
            <span className="text-xs mt-1">Navigate</span>
          </button>
          <button 
            onClick={() => setView('profile')} 
            className={`flex flex-col items-center w-full p-2 rounded-lg ${view === 'profile' ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <Award size={24} />
            <span className="text-xs mt-1">Rewards</span>
          </button>
        </nav>
      </div>
    </AppContext.Provider>
  );
}