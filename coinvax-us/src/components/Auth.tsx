import React, { useState, useRef, useEffect } from 'react';
import { 
  Mail, Lock, User, ArrowRight, Bitcoin, Shield, Zap, Phone, Globe, 
  Calendar, MapPin, Briefcase, DollarSign, CreditCard, Camera, 
  CheckCircle2, ArrowLeft, Landmark, Eye, EyeOff, AlertCircle, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import Logo from './Logo';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

type SignupStep = 1 | 2 | 3 | 4 | 5 | 6;

const nationalities = [
  "American", "British", "Canadian", "Australian", "German", "French", "Japanese", "Chinese", "Indian", "Brazilian", "Mexican", "Italian", "Spanish", "Russian", "South Korean", "Nigerian", "South African", "Egyptian", "Turkish", "Saudi Arabian", "Other"
];

const countries = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Japan", "China", "India", "Brazil", "Mexico", "Italy", "Spain", "Russia", "South Korea", "Nigeria", "South Africa", "Egypt", "Turkey", "Saudi Arabia", "Other"
];

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<SignupStep>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Contact & Login
    email: '',
    phone: '',
    password: '',
    
    // Personal Identity
    firstName: '',
    lastName: '',
    dob: '',
    nationality: '',
    idType: 'passport',
    idNumber: '',
    selfie: null as File | null,
    
    // Residential
    address: '',
    country: '',
    
    // Financial
    sourceOfFunds: '',
    occupation: '',
    employer: '',
    
    // Payment/Banking
    bankAccountNumber: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    
    // Compliance
    agreedToTerms: false,
    amlDeclaration: false,
    pepStatus: 'no',
    taxResidency: '',
  });

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure you have granted camera permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
            setFormData(prev => ({ ...prev, selfie: file }));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, selfie: e.target.files![0] }));
    }
  };

  const nextStep = () => setStep(prev => (prev + 1) as SignupStep);
  const prevStep = () => setStep(prev => (prev - 1) as SignupStep);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && step < 6) {
      nextStep();
      return;
    }

    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Update profile with name
        await updateProfile(user, {
          displayName: `${formData.firstName} ${formData.lastName}`,
        });

        // Save extra data to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          dob: formData.dob,
          nationality: formData.nationality,
          address: formData.address,
          country: formData.country,
          occupation: formData.occupation,
          employer: formData.employer,
          createdAt: new Date().toISOString(),
          balance: 0,
          outcomeMode: 'normal',
          allocations: {
            'Main Account': 0,
            'Trading Account': 0,
            'Options Account': 0,
            'P2P Account': 0
          }
        });
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = err.message || "An error occurred during authentication.";
      
      if (err.code === 'auth/network-request-failed') {
        message = "Network request failed. This usually happens if your internet is unstable, a firewall is blocking Firebase, or the domain is not authorized in the Firebase Console.";
      }
      
      setError(message);
      setLoading(false);
    }
  };

  const renderSignupStep = () => {
    switch (step) {
      case 1: // Contact & Login Details
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Strong Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-emerald-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        );
      case 2: // Personal Identity Information
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">First Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                    placeholder="John"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Last Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Date of Birth</label>
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="date"
                    name="dob"
                    required
                    value={formData.dob}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Nationality</label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <select
                    name="nationality"
                    required
                    value={formData.nationality}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                  >
                    <option value="">Select Nationality</option>
                    {nationalities.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Government ID Type</label>
              <select
                name="idType"
                value={formData.idType}
                onChange={handleInputChange}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
              >
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="drivers_license">Driver's License</option>
              </select>
            </div>
          </div>
        );
      case 3: // Residential Information
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Home Address</label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-4 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <textarea
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                  placeholder="123 Trading St, Wall District..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Country of Residence</label>
              <div className="relative group">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <select
                  name="country"
                  required
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select Country</option>
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        );
      case 4: // Financial Information
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Source of Funds/Income</label>
              <div className="relative group">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <select
                  name="sourceOfFunds"
                  required
                  value={formData.sourceOfFunds}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select Source</option>
                  <option value="salary">Salary / Employment</option>
                  <option value="business">Business Profits</option>
                  <option value="investments">Investments</option>
                  <option value="inheritance">Inheritance</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Occupation</label>
              <div className="relative group">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  name="occupation"
                  required
                  value={formData.occupation}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  placeholder="Software Engineer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Employer Details</label>
              <input
                type="text"
                name="employer"
                required
                value={formData.employer}
                onChange={handleInputChange}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                placeholder="Company Name"
              />
            </div>
          </div>
        );
      case 5: // Payment/Banking Details
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Bank Account Number</label>
              <div className="relative group">
                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  name="bankAccountNumber"
                  required
                  value={formData.bankAccountNumber}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                  placeholder="Enter account number"
                />
              </div>
            </div>
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-bold text-white">Card Funding (Optional)</span>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  name="cardNumber"
                  value={formData.cardNumber}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-sans font-black"
                  placeholder="0000 0000 0000 0000"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    name="cardExpiry"
                    value={formData.cardExpiry}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                    placeholder="MM/YY"
                  />
                  <input
                    type="text"
                    name="cardCvv"
                    value={formData.cardCvv}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                    placeholder="CVV"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 6: // Compliance & Legal
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Facial Verification (KYC)</label>
              
              {isCameraActive ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-64 object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button 
                      type="button"
                      onClick={stopCamera}
                      className="p-3 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <button 
                      type="button"
                      onClick={capturePhoto}
                      className="p-3 bg-emerald-500 text-zinc-950 rounded-full hover:bg-emerald-400 transition-colors"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={startCamera}
                  className="border-2 border-dashed border-zinc-800 rounded-2xl p-6 text-center hover:border-emerald-500/50 transition-colors cursor-pointer relative"
                >
                  {formData.selfie ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <span className="text-sm font-medium text-white">Selfie Captured</span>
                      <span className="text-xs text-zinc-500 mt-2">Click to retake</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-8 h-8 text-zinc-600" />
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Take Selfie</span>
                      <span className="text-xs text-zinc-500 mt-2">Camera permission will be requested</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-1">
                  <input 
                    type="checkbox" 
                    name="agreedToTerms"
                    checked={formData.agreedToTerms}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-5 h-5 border-2 rounded transition-all flex items-center justify-center",
                    formData.agreedToTerms ? "bg-emerald-500 border-emerald-500" : "border-zinc-800 group-hover:border-zinc-700"
                  )}>
                    {formData.agreedToTerms && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />}
                  </div>
                </div>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight">I agree to the Terms of Service and Privacy Policy.</span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-1">
                  <input 
                    type="checkbox" 
                    name="amlDeclaration"
                    checked={formData.amlDeclaration}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <div className={cn(
                    "w-5 h-5 border-2 rounded transition-all flex items-center justify-center",
                    formData.amlDeclaration ? "bg-emerald-500 border-emerald-500" : "border-zinc-800 group-hover:border-zinc-700"
                  )}>
                    {formData.amlDeclaration && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />}
                  </div>
                </div>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-tight">I declare that funds are not from illegal activities (AML).</span>
              </label>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">PEP Status</label>
                <select
                  name="pepStatus"
                  value={formData.pepStatus}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-sm appearance-none"
                >
                  <option value="no">Not a Politically Exposed Person</option>
                  <option value="yes">I am a Politically Exposed Person</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Tax Residency Info</label>
                <input
                  type="text"
                  name="taxResidency"
                  required
                  value={formData.taxResidency}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                  placeholder="TIN or Tax ID Number"
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 sm:p-12 font-sans">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Logo Section */}
        <Logo showSubtitle={true} />

        {/* Form Container */}
        <div className="w-full bg-[#121212] border border-zinc-800/50 rounded-[32px] p-8 shadow-2xl">
          {/* Login/Register Toggle */}
          <div className="flex bg-black/40 p-1.5 rounded-2xl mb-8 border border-zinc-800/30">
            <button
              onClick={() => { setIsLogin(true); setStep(1); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300",
                isLogin ? "bg-[#222222] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setStep(1); }}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300",
                !isLogin ? "bg-[#222222] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in zoom-in-95">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {isLogin ? (
              <div className="space-y-5">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#10C080] transition-colors" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-transparent border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#10C080]/30 focus:border-[#10C080]/50 transition-all font-medium placeholder:text-zinc-600"
                    placeholder="Email Address"
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#10C080] transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-transparent border border-zinc-800 text-white rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-[#10C080]/30 focus:border-[#10C080]/50 transition-all font-medium placeholder:text-zinc-600"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-[#10C080] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {renderSignupStep()}
              </div>
            )}

            <div className="flex gap-4 pt-2">
              {!isLogin && step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 border border-zinc-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#10C080] hover:bg-[#0EA870] disabled:opacity-50 text-black font-black text-lg py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-[0_10px_20px_rgba(16,192,128,0.2)]"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : step === 6 ? 'Complete' : 'Next Step'}
                    {!isLogin && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </>
                )}
              </button>
            </div>
          </form>

          {isLogin && (
            <div className="mt-6 text-center">
              <button type="button" className="text-sm font-medium text-zinc-500 hover:text-[#10C080] transition-colors">
                Forgot Password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
