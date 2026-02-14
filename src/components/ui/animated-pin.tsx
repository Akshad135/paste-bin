"use client";

import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

export interface PinIconHandle {
    startAnimation: () => void;
    stopAnimation: () => void;
}

interface PinIconProps extends HTMLAttributes<HTMLDivElement> {
    size?: number;
}

const PinIcon = forwardRef<PinIconHandle, PinIconProps>(
    ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
        const controls = useAnimation();
        const isControlledRef = useRef(false);

        useImperativeHandle(ref, () => {
            isControlledRef.current = true;
            return {
                startAnimation: () => controls.start("animate"),
                stopAnimation: () => controls.start("normal"),
            };
        });

        const handleMouseEnter = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (isControlledRef.current) {
                    onMouseEnter?.(e);
                } else {
                    controls.start("animate");
                }
            },
            [controls, onMouseEnter]
        );

        const handleMouseLeave = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                if (isControlledRef.current) {
                    onMouseLeave?.(e);
                } else {
                    controls.start("normal");
                }
            },
            [controls, onMouseLeave]
        );

        return (
            <div
                className={cn(className)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...props}
            >
                <svg
                    fill="none"
                    height={size}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width={size}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <motion.path
                        animate={controls}
                        d="M12 17v5"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        variants={{
                            normal: { y: 0, opacity: 1 },
                            animate: { y: [0, 2, 0], opacity: [1, 0.5, 1] },
                        }}
                    />
                    <motion.path
                        animate={controls}
                        d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2z"
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        variants={{
                            normal: { rotate: 0, y: 0 },
                            animate: { rotate: [0, -8, 8, 0], y: [0, -1, 0] },
                        }}
                        style={{ transformOrigin: "50% 50%" }}
                    />
                </svg>
            </div>
        );
    }
);

PinIcon.displayName = "PinIcon";

export { PinIcon };
