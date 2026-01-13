import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { User, Stethoscope, Cloud, ShieldCheck, Ban } from "lucide-react"
import { useState } from "react"
import { PatientDashboardPreview, DoctorDashboardPreview } from "@/components/landing/DashboardPreviews"
import Footer from "@/components/layout/Footer"
import SEO from "@/components/SEO"

export default function Landing() {
    const [activeTab, setActiveTab] = useState<"patient" | "doctor">("patient")

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.1
            }
        }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 100 }
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            <SEO
                title="SeSPHR - Secure Smart Personal Health Record Platform"
                description="SeSPHR provides secure, encrypted storage for personal health records with verified doctor access. Your data, your control."
                keywords="PHR, EHR, Health Records, Secure Health Data, Medical Encryption, Patient Portal"
            />
            {/* Navbar / Header - Matching Topbar style */}
            <header className="fixed top-0 left-0 right-0 h-14 border-b bg-white flex items-center justify-center z-50 shadow-sm">
                <div className="w-full max-w-7xl flex justify-between items-center px-6">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="SeSPHR" className="h-10 w-auto object-contain" />
                    </div>
                    <Link to="/login" className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
                        Sign In
                    </Link>
                </div>
            </header>

            <motion.main
                className="max-w-7xl mx-auto px-6 pt-32 pb-12 flex flex-col items-center"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Hero Section */}
                <motion.div
                    className="grid lg:grid-cols-2 gap-12 lg:gap-20 w-full mb-24 items-center"
                    variants={itemVariants}
                >
                    {/* Left Column: Content */}
                    <div className="flex flex-col items-start text-left order-2 lg:order-1">
                        <div className="mb-6">
                            <img src="/logo.png" alt="SeSPHR" className="h-24 md:h-32 w-auto object-contain" />
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
                            Secure Sharing of <br />
                            <span className="text-blue-600">Personal Health Records</span>
                        </h1>
                        <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
                            Powered by Hybrid Encryption. Your data remains encrypted in the cloud and only accessible to verified doctors you authorize.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <Link
                                to="/login"
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md"
                            >
                                <User className="w-5 h-5" />
                                Patient Portal
                            </Link>

                            <Link
                                to="/login"
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm"
                            >
                                <Stethoscope className="w-5 h-5" />
                                Doctor Portal
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Dashboard Preview */}
                    <div className="order-1 lg:order-2 w-full flex flex-col items-center">
                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-slate-100 rounded-lg mb-6 shadow-inner w-fit">
                            <button
                                onClick={() => setActiveTab("patient")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "patient"
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                Patient View
                            </button>
                            <button
                                onClick={() => setActiveTab("doctor")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "doctor"
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                Doctor View
                            </button>
                        </div>

                        {/* Preview Container */}
                        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 overflow-hidden">
                            {/* Mac-style Window Controls */}
                            <div className="flex gap-1.5 px-3 py-2 border-b border-slate-100 mb-2">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>

                            <div className="bg-slate-50 rounded-xl overflow-hidden min-h-[400px] relative">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeTab}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="h-full"
                                    >
                                        {activeTab === "patient" ? <PatientDashboardPreview /> : <DoctorDashboardPreview />}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Features Section */}
                <motion.div variants={itemVariants} className="w-full max-w-6xl mt-12">
                    <div className="text-center mb-16">
                        <span className="text-xs font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Security Architecture</span>
                        <h3 className="text-3xl font-bold text-slate-900 mt-6">Why SeSPHR?</h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Blind Cloud */}
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Cloud className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-2">Blind Cloud</h4>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Data is encrypted in your browser before upload. The server <strong>never</strong> sees your raw health data.
                            </p>
                        </div>

                        {/* Verified Access */}
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-2">Verified Access</h4>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Only authorized doctors with valid keys and identity checks can decrypt patient records.
                            </p>
                        </div>

                        {/* Instant Revocation */}
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 hover:border-rose-200 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Ban className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 mb-2">Instant Revocation</h4>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Revoke access anytime. Past keys become useless immediately, ensuring your data stays yours.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </motion.main>

            <Footer />
        </div>
    )
}
