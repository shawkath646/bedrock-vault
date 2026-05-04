import { type ReactElement } from "react";
import { Navigate } from "react-router-dom";
import AnimatedPage from "./AnimatedPage";

interface SafeRoutingProps {
    children: ReactElement;
    initialized: boolean;
    direction: number;
}

const SafeRouting = ({ children, initialized, direction }: SafeRoutingProps) => {
    if (!initialized) {
        return <Navigate to="/setup" replace />;
    }

    return (
        <AnimatedPage direction={direction}>
            {children}
        </AnimatedPage>
    );
};
export default SafeRouting;