"use client";

import React, { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { User, Key, Stethoscope, Cloud } from "lucide-react";

// Simple Custom Tooltip Component
const CircleTooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
    return (
        <div className="group relative flex flex-col items-center">
            {children}
            <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:-translate-y-1 z-20 whitespace-nowrap">
                <div className="flex flex-col items-center">
                    <div className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl">
                        {text}
                    </div>
                    <div className="-mt-1 h-2 w-2 rotate-45 bg-slate-900"></div>
                </div>
            </div>
        </div>
    );
};

const Circle = forwardRef<
    HTMLDivElement,
    { className?: string; children?: React.ReactNode }
>(({ className, children }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 bg-white p-3 shadow-lg transition-transform duration-200 hover:scale-110",
                className,
            )}
        >
            {children}
        </div>
    );
});

Circle.displayName = "Circle";

export function ArchitectureDiagram({ className }: { className?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Input Nodes
    const div1Ref = useRef<HTMLDivElement>(null); // Patient
    const div2Ref = useRef<HTMLDivElement>(null); // Key

    // Center Node
    const div3Ref = useRef<HTMLDivElement>(null); // SeSPHR Shield

    // Output Nodes
    const div4Ref = useRef<HTMLDivElement>(null); // Doctor
    const div5Ref = useRef<HTMLDivElement>(null); // Cloud

    return (
        <div
            className={cn(
                "relative flex w-full max-w-5xl items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/30 p-10 border border-slate-200 shadow-lg shadow-slate-200/50",
                className,
            )}
            ref={containerRef}
        >
            <div className="flex w-full flex-row items-stretch justify-between gap-10">

                {/* Left Column: Inputs */}
                <div className="flex flex-col justify-center gap-16">
                    <CircleTooltip text="Patient: Encrypts data locally">
                        <Circle ref={div1Ref} className="border-blue-100/50 bg-blue-50 text-blue-600">
                            <User className="h-8 w-8" />
                        </Circle>
                    </CircleTooltip>
                    <CircleTooltip text="Secret Key: Never leaves the device">
                        <Circle ref={div2Ref} className="border-amber-100/50 bg-amber-50 text-amber-600">
                            <Key className="h-8 w-8" />
                        </Circle>
                    </CircleTooltip>
                </div>

                {/* Center Column: Hub */}
                <div className="flex flex-col justify-center">
                    <CircleTooltip text="SeSPHR Proxy: Re-encryption Engine">
                        <Circle ref={div3Ref} className="h-24 w-24 border-slate-200 bg-white shadow-xl">
                            <img src="/logo.png" alt="SeSPHR" className="h-16 w-16 object-contain p-1" />
                        </Circle>
                    </CircleTooltip>
                </div>

                {/* Right Column: Outputs */}
                <div className="flex flex-col justify-center gap-16">
                    <CircleTooltip text="Doctor: Decrypts with authorized key">
                        <Circle ref={div4Ref} className="border-emerald-100/50 bg-emerald-50 text-emerald-600">
                            <Stethoscope className="h-8 w-8" />
                        </Circle>
                    </CircleTooltip>
                    <CircleTooltip text="Cloud Storage: Blind hosting only">
                        <Circle ref={div5Ref} className="border-indigo-100/50 bg-indigo-50 text-indigo-600">
                            <Cloud className="h-8 w-8" />
                        </Circle>
                    </CircleTooltip>
                </div>
            </div>

            {/* Beams: Inputs -> Center */}
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div1Ref}
                toRef={div3Ref}
                curvature={40}
                endYOffset={-10}
                pathColor="#93c5fd" // tailwind blue-300
                gradientStartColor="#2563eb" // tailwind blue-600
                gradientStopColor="#60a5fa" // tailwind blue-400
                pathWidth={3}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div2Ref}
                toRef={div3Ref}
                curvature={-40}
                endYOffset={10}
                pathColor="#fcd34d" // tailwind amber-300
                gradientStartColor="#d97706" // tailwind amber-600
                gradientStopColor="#fbbf24" // tailwind amber-400
                pathWidth={3}
            />

            {/* Beams: Center -> Outputs */}
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div3Ref}
                toRef={div4Ref}
                curvature={40}
                startYOffset={-10}
                pathColor="#6ee7b7" // tailwind emerald-300
                gradientStartColor="#059669" // tailwind emerald-600
                gradientStopColor="#34d399" // tailwind emerald-400
                reverse
                pathWidth={3}
            />
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={div3Ref}
                toRef={div5Ref}
                curvature={-40}
                startYOffset={10}
                pathColor="#a5b4fc" // tailwind indigo-300
                gradientStartColor="#4f46e5" // tailwind indigo-600
                gradientStopColor="#818cf8" // tailwind indigo-400
                reverse
                pathWidth={3}
            />
        </div>
    );
}
