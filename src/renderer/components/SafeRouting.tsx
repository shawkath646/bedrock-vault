import { type ReactElement, useContext } from "react";
import { Navigate } from "react-router-dom";
import { AppConfigContext } from "@renderer/contexts/AppConfigContext";

interface SafeRoutingProps {
    children: ReactElement;
}

const SafeRouting = ({ children }: SafeRoutingProps) => {
    const ctx = useContext(AppConfigContext);
    const initialized = !!ctx?.config?.initialized;

    if (!initialized) {
        return <Navigate to="/setup" replace />;
    }

    return children;
};

export default SafeRouting;