import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { GoogleLogin } from '@react-oauth/google'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
// import illustration from '../public/illustration.png'

export default function Login() {
  const { login, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState('candidate')

  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back! 🚀')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-[#E8F4F8] relative overflow-hidden font-sans">
      
      {/* LEFT TEXT SECTION */}
      <div className="absolute top-[35px] left-[120px] w-[420px] z-10 hidden lg:block">
        {/* LOGO */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-[40px] h-[40px] rounded-[12px] bg-[#2E9BDA] flex items-center justify-center">
            <span className="text-white font-semibold text-[18px]">C</span>
          </div>
          <span className="text-[30px] font-semibold text-[#111827]">
            Career<span className="text-[#2E9BDA]">AI</span>
          </span>
        </div>

        {/* HEADING */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-[50px] leading-[56px] font-bold text-[#111827]">
            Welcome back to your <br />
            <span className="text-[#0b9ce5ff]">future.</span>
          </h1>
          <p className="text-[18px] text-[#6B7280] mt-5">
            Sign in to continue your journey towards better opportunities with AI.
          </p>
        </motion.div>
      </div>

      {/* ILLUSTRATION */}
      <div className="relative w-full h-full rounded-[90px] overflow-hidden hidden lg:block">
        <div className="absolute bottom-[20px] left-[130px] z-0">
        <img
          src="/illustration.png" // Direct slash se start karein, Vite public folder se khud utha lega
          alt="illustration"
          className="w-[550px] max-w-none object-contain animate-[float_6s_ease-in-out_infinite]"
        />

        </div>
        <div className="absolute left-0 bottom-0 h-full w-[30%] bg-gradient-to-r from-[#E8F4F8] via-[#E8F4F8]/80 to-transparent"></div>
      </div>

      {/* RIGHT CARD SECTION */}
      <div className="absolute top-0 right-0 lg:top-[30px] lg:right-[130px] lg:bottom-[20px] w-full lg:w-[640px] z-20 h-full lg:h-auto flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="w-full h-full bg-white lg:rounded-[28px] border border-[#D1D5DB] shadow-[0_30px_80px_rgba(0,0,0,0.08)] flex items-center overflow-y-auto"
        >
          <div className="w-full px-[20px] md:px-[48px] py-10">
            <h1 className="text-[30px] font-semibold text-[#111827]">Welcome back!</h1>
            <p className="text-[13px] text-[#2E9BDA] mt-2 mb-6 font-medium">
              Great opportunities start with a single step.
            </p>

            {/* ROLE SELECTOR (Aapke Code Se) */}
            <div className="mb-6">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">I am a:</p>
              <div className="flex bg-slate-100 rounded-xl p-1">
                {['candidate', 'recruiter'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                      selectedRole === role ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                    }`}
                    onClick={() => setSelectedRole(role)}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-5">
                {/* EMAIL */}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' },
                    })}
                    className={`w-full h-[48px] pl-12 pr-4 border ${
                      errors.email ? 'border-red-500' : 'border-[#D1D5DB]'
                    } rounded-[10px] focus:border-[#2E9BDA] focus:ring-2 focus:ring-[#2E9BDA]/20 outline-none`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email.message}</p>}
                </div>

                {/* PASSWORD */}
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' },
                    })}
                    className={`w-full h-[48px] pl-12 pr-12 border ${
                      errors.password ? 'border-red-500' : 'border-[#D1D5DB]'
                    } rounded-[10px] focus:border-[#2E9BDA] focus:ring-2 focus:ring-[#2E9BDA]/20 outline-none`}
                  />
                  <div 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-[#2E9BDA]"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </div>
                  {errors.password && <p className="text-red-500 text-xs mt-1 ml-1">{errors.password.message}</p>}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-[#6B7280] cursor-pointer">
                    <input type="checkbox" className="accent-[#2E9BDA] w-4 h-4" />
                    Remember me
                  </label>
                  <Link to="/forgot-password" university className="text-[#2E9BDA] hover:underline font-medium">
                    Forgot Password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 rounded-xl font-bold mt-2 shadow-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>

            {/* SEPARATOR */}
            <div className="mt-8 mb-6 flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-[#E5E7EB]"></div>
              <span className="text-sm text-[#6B7280] font-medium">or continue with</span>
              <div className="flex-1 h-[1px] bg-[#E5E7EB]"></div>
            </div>

            {/* GOOGLE LOGIN (Actual Integration) */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    await googleLogin(credentialResponse.credential, selectedRole)
                    toast.success('Welcome! 🚀')
                    navigate('/dashboard')
                  } catch (err) {
                    toast.error(err.response?.data?.detail || 'Google login failed')
                  }
                }}
                onError={() => toast.error('Google Sign-In failed')}
                useOneTap
                theme="outline"
                shape="pill"
                width="320"
              />
            </div>

            <p className="text-center text-sm mt-8 text-[#6B7280]">
              Don’t have an account?
              <Link to="/signup" className="text-[#2E9BDA] ml-1 font-bold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  )
}
