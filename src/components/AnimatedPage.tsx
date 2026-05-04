import { motion, type Variants } from 'framer-motion';
import type { ReactElement } from 'react';

const animations: Variants = {
    initial: (direction) => ({
        x: direction > 0 ? 50 : -50,
        opacity: 0,
    }),
    animate: {
        x: 0,
        opacity: 1,
        transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: (direction) => ({
        x: direction > 0 ? -50 : 50,
        opacity: 0,
        transition: { duration: 0.3, ease: "easeIn" }
    }),
};

export default function AnimatedPage({ children, direction }: { children: ReactElement, direction: number }) {
    return (
        <motion.div
            custom={direction}
            variants={animations}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="h-full w-full"
        >
            {children}
        </motion.div>
    );
}