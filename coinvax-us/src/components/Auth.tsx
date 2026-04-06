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
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguans", "Argentinean", "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burundian", "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti", "Dominican", "Dutch", "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "Icelander", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Moroccan", "Mosotho", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Ni-Vanuatu", "Nicaraguan", "Nigerian", "Nigerien", "North Korean", "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander", "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Switzerland", "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian", "Tunisian", "Turkish", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh", "Yemenite", "Zambian", "Zimbabwean"
];

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia (Czech Republic)", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Holy See", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar (formerly Burma)", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const countryCodes = [
  { code: "+1", country: "USA/Canada" },
  { code: "+44", country: "UK" },
  { code: "+256", country: "Uganda" },
  { code: "+234", country: "Nigeria" },
  { code: "+27", country: "South Africa" },
  { code: "+91", country: "India" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+7", country: "Russia" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+61", country: "Australia" },
  { code: "+82", country: "South Korea" },
  { code: "+90", country: "Turkey" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+971", country: "UAE" },
  { code: "+20", country: "Egypt" },
  { code: "+63", country: "Philippines" },
  { code: "+62", country: "Indonesia" },
  { code: "+60", country: "Malaysia" },
  { code: "+66", country: "Thailand" },
  { code: "+84", country: "Vietnam" },
  { code: "+92", country: "Pakistan" },
  { code: "+880", country: "Bangladesh" },
  { code: "+254", country: "Kenya" },
  { code: "+233", country: "Ghana" },
  { code: "+212", country: "Morocco" },
  { code: "+213", country: "Algeria" },
  { code: "+216", country: "Tunisia" },
  { code: "+218", country: "Libya" },
  { code: "+251", country: "Ethiopia" },
  { code: "+255", country: "Tanzania" },
  { code: "+249", country: "Sudan" },
  { code: "+244", country: "Angola" },
  { code: "+225", country: "Ivory Coast" },
  { code: "+237", country: "Cameroon" },
  { code: "+221", country: "Senegal" },
  { code: "+263", country: "Zimbabwe" },
  { code: "+260", country: "Zambia" },
  { code: "+265", country: "Malawi" },
  { code: "+264", country: "Namibia" },
  { code: "+267", country: "Botswana" },
  { code: "+268", country: "Eswatini" },
  { code: "+266", country: "Lesotho" },
  { code: "+230", country: "Mauritius" },
  { code: "+248", country: "Seychelles" },
  { code: "+238", country: "Cape Verde" },
  { code: "+239", country: "Sao Tome" },
  { code: "+240", country: "Equatorial Guinea" },
  { code: "+241", country: "Gabon" },
  { code: "+242", country: "Congo" },
  { code: "+243", country: "DR Congo" },
  { code: "+250", country: "Rwanda" },
  { code: "+257", country: "Burundi" },
  { code: "+252", country: "Somalia" },
  { code: "+253", country: "Djibouti" },
  { code: "+258", country: "Mozambique" },
  { code: "+261", country: "Madagascar" },
  { code: "+262", country: "Reunion" },
  { code: "+269", country: "Comoros" },
  { code: "+290", country: "Saint Helena" },
  { code: "+291", country: "Eritrea" },
  { code: "+297", country: "Aruba" },
  { code: "+298", country: "Faroe Islands" },
  { code: "+299", country: "Greenland" },
  { code: "+350", country: "Gibraltar" },
  { code: "+351", country: "Portugal" },
  { code: "+352", country: "Luxembourg" },
  { code: "+353", country: "Ireland" },
  { code: "+354", country: "Iceland" },
  { code: "+355", country: "Albania" },
  { code: "+356", country: "Malta" },
  { code: "+357", country: "Cyprus" },
  { code: "+358", country: "Finland" },
  { code: "+359", country: "Bulgaria" },
  { code: "+370", country: "Lithuania" },
  { code: "+371", country: "Latvia" },
  { code: "+372", country: "Estonia" },
  { code: "+373", country: "Moldova" },
  { code: "+374", country: "Armenia" },
  { code: "+375", country: "Belarus" },
  { code: "+376", country: "Andorra" },
  { code: "+377", country: "Monaco" },
  { code: "+378", country: "San Marino" },
  { code: "+380", country: "Ukraine" },
  { code: "+381", country: "Serbia" },
  { code: "+382", country: "Montenegro" },
  { code: "+385", country: "Croatia" },
  { code: "+386", country: "Slovenia" },
  { code: "+387", country: "Bosnia" },
  { code: "+389", country: "North Macedonia" },
  { code: "+420", country: "Czech Republic" },
  { code: "+421", country: "Slovakia" },
  { code: "+423", country: "Liechtenstein" },
  { code: "+972", country: "Israel" },
  { code: "+973", country: "Bahrain" },
  { code: "+974", country: "Qatar" },
  { code: "+975", country: "Bhutan" },
  { code: "+976", country: "Mongolia" },
  { code: "+977", country: "Nepal" },
  { code: "+992", country: "Tajikistan" },
  { code: "+993", country: "Turkmenistan" },
  { code: "+994", country: "Azerbaijan" },
  { code: "+995", country: "Georgia" },
  { code: "+996", country: "Kyrgyzstan" },
  { code: "+998", country: "Uzbekistan" }
];

const ImagePreview = ({ file, onRetake }: { file: File, onRetake: () => void }) => {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  
  return (
    <div className="relative w-full h-48 rounded-2xl overflow-hidden group border-2 border-emerald-500/50">
      <img src={url} alt="Preview" className="w-full h-full object-cover absolute inset-0" />
      <div 
        onClick={(e) => { e.stopPropagation(); onRetake(); }}
        className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
      >
        <Camera className="w-8 h-8 text-white mb-2" />
        <span className="text-sm font-bold text-white uppercase tracking-wider">Retake Photo</span>
      </div>
    </div>
  );
};

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
    countryCode: '+1',
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
    idFront: null as File | null,
    idBack: null as File | null,
    
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
  const [capturingType, setCapturingType] = useState<'selfie' | 'idFront' | 'idBack' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const startCamera = async (type: 'selfie' | 'idFront' | 'idBack') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: type === 'selfie' ? 'user' : 'environment' } } 
      });
      setCameraStream(stream);
      setCapturingType(type);
      setIsCameraActive(true);
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
    setCapturingType(null);
  };

  const clearPhoto = (type: 'selfie' | 'idFront' | 'idBack') => {
    setFormData(prev => ({ ...prev, [type]: null }));
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && capturingType) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const fileName = `${capturingType}.jpg`;
            const file = new File([blob], fileName, { type: "image/jpeg" });
            setFormData(prev => ({ ...prev, [capturingType]: file }));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  // Attach stream to video element when it mounts
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'selfie' | 'idFront' | 'idBack') => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [type]: e.target.files![0] }));
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
          phone: `${formData.countryCode}${formData.phone}`,
          dob: formData.dob,
          nationality: formData.nationality,
          address: formData.address,
          country: formData.country,
          occupation: formData.occupation,
          employer: formData.employer,
          bankAccountNumber: formData.bankAccountNumber,
          taxResidency: formData.taxResidency,
          verificationStatus: 'pending',
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
              <div className="flex gap-2">
                <div className="relative w-32 group">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <select
                    name="countryCode"
                    value={formData.countryCode}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-10 pr-2 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none text-sm"
                  >
                    {countryCodes.map(c => (
                      <option key={`${c.country}-${c.code}`} value={c.code}>
                        {c.code} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-1 group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
                    placeholder="555 000-0000"
                  />
                </div>
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
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Bank Account Number (Optional)</label>
              <div className="relative group">
                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  type="text"
                  name="bankAccountNumber"
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
            <div className="space-y-4">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Account Verification (KYC)</label>
              
              {/* Selfie / Passport Photo */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Selfie or Passport Photo</span>
                {isCameraActive && capturingType === 'selfie' ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <button type="button" onClick={stopCamera} className="p-2 bg-rose-500 text-white rounded-full"><X className="w-5 h-5" /></button>
                      <button type="button" onClick={capturePhoto} className="p-2 bg-emerald-500 text-zinc-950 rounded-full"><Camera className="w-5 h-5" /></button>
                    </div>
                  </div>
                ) : formData.selfie ? (
                  <ImagePreview file={formData.selfie} onRetake={() => clearPhoto('selfie')} />
                ) : (
                  <div className="flex gap-2">
                    <div 
                      onClick={() => startCamera('selfie')}
                      className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Camera className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Take Photo</span>
                      </div>
                    </div>
                    <label className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" />
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Upload</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* ID Front */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Government ID Front</span>
                {isCameraActive && capturingType === 'idFront' ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <button type="button" onClick={stopCamera} className="p-2 bg-rose-500 text-white rounded-full"><X className="w-5 h-5" /></button>
                      <button type="button" onClick={capturePhoto} className="p-2 bg-emerald-500 text-zinc-950 rounded-full"><Camera className="w-5 h-5" /></button>
                    </div>
                  </div>
                ) : formData.idFront ? (
                  <ImagePreview file={formData.idFront} onRetake={() => clearPhoto('idFront')} />
                ) : (
                  <div className="flex gap-2">
                    <div 
                      onClick={() => startCamera('idFront')}
                      className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Camera className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Take Photo</span>
                      </div>
                    </div>
                    <label className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'idFront')} className="hidden" />
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Upload</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* ID Back */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Government ID Back</span>
                {isCameraActive && capturingType === 'idBack' ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <button type="button" onClick={stopCamera} className="p-2 bg-rose-500 text-white rounded-full"><X className="w-5 h-5" /></button>
                      <button type="button" onClick={capturePhoto} className="p-2 bg-emerald-500 text-zinc-950 rounded-full"><Camera className="w-5 h-5" /></button>
                    </div>
                  </div>
                ) : formData.idBack ? (
                  <ImagePreview file={formData.idBack} onRetake={() => clearPhoto('idBack')} />
                ) : (
                  <div className="flex gap-2">
                    <div 
                      onClick={() => startCamera('idBack')}
                      className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Camera className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Take Photo</span>
                      </div>
                    </div>
                    <label className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center hover:border-emerald-500/50 transition-colors cursor-pointer">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'idBack')} className="hidden" />
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-5 h-5 text-zinc-600" />
                        <span className="text-[10px] text-zinc-500">Upload</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
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
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest ml-1">Tax Residency Info (Optional)</label>
                <input
                  type="text"
                  name="taxResidency"
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
