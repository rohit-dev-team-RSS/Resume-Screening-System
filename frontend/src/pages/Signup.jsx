import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { GoogleLogin } from '@react-oauth/google'
import { Mail, Lock, User, Eye, EyeOff, Briefcase } from 'lucide-react'

export default function Signup() {
  const { signup, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { role: 'candidate' }
  })
  
  // Watch selected role for Google Login
  const selectedRole = watch("role")

  // MANUAL SIGNUP SUBMIT
  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const payload = {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        role: data.role,
        phone: "",
        linkedin_url: "",
        github_username: ""
      }

      const res = await signup(payload)
      if (res) {
        toast.success('Your journey begins! 🚀')
        navigate('/dashboard')
      }
    } catch (err) {
      console.error(err)
      const errorMsg = err.response?.data?.detail?.[0]?.msg || 
                       err.response?.data?.detail || 
                       "Signup failed"
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // ✅ GOOGLE AUTH HANDLER
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true)
    try {
      await googleLogin(credentialResponse.credential, selectedRole)
      toast.success('Welcome to CareerAI! 🚀')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Google signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-[#E8F4F8] relative overflow-hidden font-sans">
      
      {/* LEFT TEXT (Friend's UI) */}
      <div className="absolute top-[35px] left-[120px] w-[420px] z-10 hidden lg:block">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-[40px] h-[40px] rounded-[12px] bg-[#2E9BDA] flex items-center justify-center shadow-md">
            <span className="text-white font-semibold text-[18px]">C</span>
          </div>
          <span className="text-[30px] font-semibold text-[#111827]">
            Career<span className="text-[#2E9BDA]">AI</span>
          </span>
        </div>

        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-[50px] leading-[56px] font-bold text-[#111827]">
            Scale your <br />
            <span className="text-[#0b9ce5ff]">career</span> to <br />
            new heights.
          </h1>
          <p className="text-[18px] text-[#6B7280] mt-5">
            The only AI platform designed to bridge the <br />
            gap between talent and opportunity.
          </p>
        </motion.div>
      </div>

      {/* ILLUSTRATION (Friend's UI) */}
      <div className="relative w-full h-full rounded-[90px] overflow-hidden hidden lg:block">
        <div className="absolute bottom-[20px] left-[130px] z-0">
          <img
            src="/illustration.png" 
            alt="illustration"
            className="w-[550px] max-w-none object-contain animate-[float_6s_ease-in-out_infinite]"
          />
        </div>
        <div className="absolute left-0 bottom-0 h-full w-[30%] bg-gradient-to-r from-[#E8F4F8] via-[#E8F4F8]/80 to-transparent"></div>
      </div>

      {/* RIGHT CARD (Friend's UI + Your Logic) */}
      <div className="absolute top-0 right-0 lg:top-[30px] lg:right-[130px] lg:bottom-[20px] w-full lg:w-[640px] z-20 h-full lg:h-auto flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="w-full h-full bg-white lg:rounded-[28px] border border-[#D1D5DB] shadow-[0_30px_80px_rgba(0,0,0,0.08)] flex items-center overflow-y-auto"
        >
          <div className="w-full px-[20px] md:px-[48px] py-8">
            <h2 className="text-[30px] font-semibold text-[#111827]">Join the future.</h2>
            <p className="text-[13px] text-[#2E9BDA] mt-2 mb-6 font-medium">
              Get AI-powered resume insights & job matches in seconds.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* ROLE SELECTOR */}
              <div>
                <label className="text-[13px] font-bold text-slate-500 mb-2 block uppercase tracking-wider">I am a:</label>
                <div className="flex bg-slate-100 rounded-xl p-1">
                  {['candidate', 'recruiter'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        selectedRole === role ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                      }`}
                      onClick={() => setValue("role", role)}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
                {/* Hidden input to keep react-hook-form in sync */}
                <input type="hidden" {...register("role")} />
              </div>

              {/* NAME */}
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('full_name', { 
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Name must be at least 2 characters' } // Added this
                  })}
                  placeholder="Full Name"
                  className={`w-full h-[48px] pl-12 pr-4 border rounded-[10px] outline-none transition-all ${
                    errors.full_name ? 'border-red-500' : 'border-[#D1D5DB] focus:border-[#2E9BDA]'
                  }`}
                />
              </div>
              {errors.full_name && (
                <p className="text-red-500 text-xs mt-1 ml-1 font-medium italic">{errors.full_name.message}</p>
              )}

              {/* EMAIL */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address"
                    }
                  })}
                  type="email"
                  placeholder="Email Address"
                  className="w-full h-[48px] pl-12 pr-4 border border-[#D1D5DB] rounded-[10px] focus:border-[#2E9BDA] outline-none" 
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1 ml-1 font-medium italic">{errors.email.message}</p>
              )}

              {/* PASSWORD */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full h-[48px] pl-12 pr-12 border border-[#D1D5DB] rounded-[10px] focus:border-[#2E9BDA] focus:ring-2 focus:ring-[#2E9BDA]/20 outline-none"
                />
                <div onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 ml-1 font-medium italic">
                  {errors.password.message}
                </p>
              )}
              {/* CONFIRM PASSWORD */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match'
                  })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  className={`w-full h-[48px] pl-12 pr-4 border rounded-[10px] outline-none transition-all ${
                    errors.confirm_password 
                      ? 'border-red-500 focus:ring-red-200' 
                      : 'border-[#D1D5DB] focus:border-[#2E9BDA] focus:ring-[#2E9BDA]/20'
                  } focus:ring-2`}
                />
              </div>

              {/* ERROR MESSAGE */}
              {errors.confirm_password && (
                <p className="text-red-500 text-xs mt-1 ml-1 font-medium italic">
                  {errors.confirm_password.message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 rounded-xl font-bold mt-2 shadow-lg disabled:opacity-60 transition-all hover:opacity-95"
              >
                {loading ? "Creating Account..." : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 mb-6 flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-[#E5E7EB]"></div>
              <span className="text-sm text-[#6B7280]">or continue with</span>
              <div className="flex-1 h-[1px] bg-[#E5E7EB]"></div>
            </div>

            {/* GOOGLE LOGIN */}
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google Sign-In failed')}
                useOneTap
                theme="outline"
                shape="pill"
                width="320"
              />
            </div>

            <p className="text-center text-sm mt-6 text-[#6B7280]">
              Already a member?
              <Link to="/login" className="text-[#2E9BDA] ml-1 font-bold hover:underline">
                Sign In
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
