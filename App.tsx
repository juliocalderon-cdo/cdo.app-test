

import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useDownloadManager, DownloadManagerContext } from './hooks/useDownloadManager';
import { useAuth, AuthContext, useAuthContext } from './hooks/useAuth';
import { NotificationProvider } from './hooks/useNotification';
import Home from './components/Home';
import { Dashboard } from './components/Dashboard';
import DownloadView from './components/DownloadView';
import ReportHub from './components/ReportHub';
import ReportView from './components/ReportView';
import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';
import ManhattanShipmentsView from './components/ManhattanShipmentsView';
import OlpnDistributionView from './components/OlpnDistributionView';
import FrescosDistributionReport from './components/FrescosDistributionReport';
import OperationalImpactAnalystView from './components/OperationalImpactAnalystView';
import OperationalImpactAnalystV2 from './components/OperationalImpactAnalystViewV2';
import QualityAuditsDashboard from './components/QualityAuditsDashboard';
// FIX: Add missing import for QualitySectorSelection
import QualitySectorSelection from './components/QualitySectorSelection';
import QualityLookerReports from './components/QualityLookerReports';
import ActiveAuditSession from './components/ActiveAuditSession';
import ReverseLogisticsView from './components/ReverseLogisticsView';
import LocationAuditSession from './components/LocationAuditSession';
import LocationAuditReport from './components/LocationAuditReport';
import { HomeIcon, UsersIcon, LogoutIcon, UserIcon, DocumentIcon } from './components/Icons';
import { UserRole } from './types';
import { sheets as googleSheetsService } from './services/googleSheetsService';


// --- START: Responsive Hook ---
// A robust hook that uses ResizeObserver to reliably detect container width,
// which is crucial for handling Chrome DevTools' faulty viewport reporting inside iframes.
const useResponsive = () => {
    const [isMobileLayout, setIsMobileLayout] = useState(false);

    useEffect(() => {
        const rootEl = document.getElementById('root');
        if (!rootEl) return;

        // Use ResizeObserver for reliability inside iframes
        const resizeObserver = new ResizeObserver(entries => {
            // We only have one entry, which is our #root element
            if (entries[0]) {
                const { width } = entries[0].contentRect;
                // Use a standard breakpoint (md: 768px) to switch layouts
                setIsMobileLayout(width < 768);
            }
        });

        resizeObserver.observe(rootEl);

        // Cleanup observer on component unmount
        return () => resizeObserver.disconnect();
    }, []); // Empty dependency array ensures this runs only once on mount

    return isMobileLayout;
};
// --- END: Responsive Hook ---

interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isMobile?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, isMobile = false }: NavItemProps) => {
    const baseClasses = "flex items-center rounded-md font-medium transition-colors";
    const mobileClasses = "flex-col justify-center w-24 h-full pt-4 text-base";
    const desktopClasses = "flex-row justify-start gap-3 px-3 py-2 text-sm";

    const activeClasses = isMobile ? "text-sky-400" : "bg-zinc-700 text-sky-300";
    const inactiveClasses = isMobile ? "text-zinc-400 hover:text-sky-400" : "text-zinc-400 hover:bg-zinc-700";

    return (
        <NavLink
            to={to}
            end={to === "/"}
            className={({ isActive }: { isActive: boolean }) => `${baseClasses} ${isMobile ? mobileClasses : desktopClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
            {icon}
            <span className={isMobile ? 'mt-2' : 'inline'}>{label}</span>
        </NavLink>
    );
};

interface AppConfig {
    version: string;
    ambiente: string;
}

// --- START: Navigation Components ---
const SidebarNav: React.FC<{ config: AppConfig | null }> = ({ config }) => {
    const { currentUser, logout, isAuthLoading } = useAuthContext();

    return (
        <nav className="flex flex-col justify-between w-64 bg-zinc-800 shadow-lg p-4">
            <div>
                <div className="mb-2 flex items-center justify-start pl-2 h-12">
                    <img src="https://www.grupovierci.com/wp-content/uploads/2025/11/10paises_BLANCO-1024x640.png" alt="GDNuy Logo" className="h-auto w-auto max-h-12" />
                </div>
                {config ? (
                    <div className="pl-3 mb-6 text-xs text-zinc-500 font-mono">
                        <p>APP CDO v{config.version}</p>
                        <p>Ambiente: {config.ambiente}</p>
                    </div>
                ) : (
                    <div className="pl-3 mb-6 h-8"></div> // Placeholder for layout stability
                )}
                <div className="flex flex-col justify-start gap-2">
                    <NavItem to="/" icon={<HomeIcon className="w-6 h-6" />} label="Inicio" />
                    <NavItem to="/reports" icon={<DocumentIcon className="w-6 h-6" />} label="Reportes" />
                    {currentUser?.role === UserRole.ADMIN && (
                        <>
                            <NavItem to="/users" icon={<UsersIcon className="w-6 h-6" />} label="Usuarios" />
                        </>
                    )}
                </div>
            </div>

            <div className="p-2 border-t border-zinc-700">
                {currentUser && (
                    <div className="flex flex-col items-start gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-1 bg-zinc-700 rounded-full">
                                <UserIcon className="w-5 h-5 text-zinc-300" />
                            </div>
                            <div className="block overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate" title={currentUser.name}>{currentUser.name}</p>
                                <p className="text-xs text-zinc-400 truncate" title={currentUser.username}>{currentUser.username}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            disabled={isAuthLoading}
                            className="w-full flex items-center justify-start gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                        >
                            <LogoutIcon className="w-6 h-6" />
                            <span className="inline">{isAuthLoading ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
};

const BottomNav: React.FC = () => {
    const { logout, isAuthLoading } = useAuthContext();

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-24 bg-zinc-800 shadow-[0_-2px_5px_rgba(0,0,0,0.1)] z-40">
            <div className="flex justify-around items-center h-full max-w-lg mx-auto">
                <NavItem to="/" icon={<HomeIcon className="w-8 h-8" />} label="Inicio" isMobile={true} />
                <NavItem to="/reports" icon={<DocumentIcon className="w-8 h-8" />} label="Reportes" isMobile={true} />
                <button
                    onClick={logout}
                    disabled={isAuthLoading}
                    className="flex flex-col items-center justify-center w-24 h-full pt-4 text-zinc-400 hover:text-sky-400 rounded-md transition-colors disabled:opacity-50"
                >
                    <LogoutIcon className="w-8 h-8" />
                    <span className="text-base mt-2">{isAuthLoading ? 'Saliendo...' : 'Salir'}</span>
                </button>
            </div>
        </nav>
    );
};
// --- END: Navigation Components ---

// --- START: Updated Layout Component ---
const Layout: React.FC<{ children: React.ReactNode; config: AppConfig | null }> = ({ children, config }) => {
    const isMobile = useResponsive();
    const isDesktop = !isMobile;

    return (
        <div className={`relative flex-1 ${isDesktop ? 'flex' : 'flex flex-col'}`}>
            {isDesktop ? <SidebarNav config={config} /> : null}

            <main className={`relative flex-1 overflow-y-auto min-h-0 text-zinc-200 ${isMobile ? 'pb-28' : ''}`}>
                {children}
            </main>

            {isMobile ? <BottomNav /> : null}
        </div>
    );
};
// --- END: Updated Layout Component ---

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: UserRole[] }> = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) => {
    const { currentUser, isAuthLoading } = useAuthContext();
    const location = useLocation();

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-full w-full">
                <svg className="animate-spin h-8 w-8 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
        return <Navigate to="/" replace />; // Or to an "unauthorized" page
    }

    return <>{children}</>;
};

const AppContent: React.FC<{ config: AppConfig | null }> = ({ config }) => {
    const downloadManager = useDownloadManager();
    const importRoles = [UserRole.ADMIN, UserRole.OPERADOR_IMPO, UserRole.MONITOR_IMPO];
    const qualityRoles = [UserRole.ADMIN, UserRole.CALIDAD, UserRole.FRESCOS, UserRole.OPERADOR_IMPO, UserRole.MONITOR_IMPO];

    return (
        <DownloadManagerContext.Provider value={downloadManager}>
            <Routes>
                <Route path="/login" element={<Login config={config} />} />
                <Route
                    path="/"
                    element={<ProtectedRoute><Layout config={config}><Home /></Layout></ProtectedRoute>}
                />

                {/* --- QUALITY MODULE ROUTES --- */}
                {/* FIX: Add missing route for QualitySectorSelection */}
                <Route
                    path="/quality/select-sector"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><QualitySectorSelection /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/quality/audits"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><QualityAuditsDashboard /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/quality/audit-session"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><ActiveAuditSession /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/quality/reverse-logistics"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><ReverseLogisticsView /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/quality/location-audit"
                    element={
                        <ProtectedRoute allowedRoles={qualityRoles}>
                            <Layout config={config}><LocationAuditSession /></Layout>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/imports"
                    element={
                        <ProtectedRoute allowedRoles={importRoles}>
                            <Layout config={config}><Dashboard /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/download/:taskId"
                    element={
                        <ProtectedRoute allowedRoles={importRoles}>
                            <Layout config={config}><DownloadView /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/manhattan-shipments"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.TRANSPORTE]}>
                            <Layout config={config}><ManhattanShipmentsView /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/frescos/olpn-distribution"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.FRESCOS]}>
                            <Layout config={config}><OlpnDistributionView /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={<ProtectedRoute><Layout config={config}><ReportHub /></Layout></ProtectedRoute>}
                />
                <Route
                    path="/reports/imports"
                    element={
                        <ProtectedRoute allowedRoles={importRoles}>
                            <Layout config={config}><ReportView /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports/frescos-distribution"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.FRESCOS]}>
                            <Layout config={config}><FrescosDistributionReport /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports/location-audit"
                    element={
                        <ProtectedRoute allowedRoles={qualityRoles}>
                            <Layout config={config}><LocationAuditReport /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports/quality-looker-secos"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><QualityLookerReports reportType="secos" /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports/quality-looker-frescos"
                    element={
                        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.CALIDAD]}>
                            <Layout config={config}><QualityLookerReports reportType="frescos" /></Layout>
                        </ProtectedRoute>
                    }
                />
                <Route path="/agents" element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <Layout config={config}><OperationalImpactAnalystView /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/agents-v2" element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <Layout config={config}><OperationalImpactAnalystV2 /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/users" element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <Layout config={config}><UserManagement /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </DownloadManagerContext.Provider>
    );
}

const App: React.FC = () => {
    const authManager = useAuth();
    const [config, setConfig] = useState<AppConfig | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const appConfig = await googleSheetsService.getAppConfig();
                setConfig(appConfig);
            } catch (err) {
                console.error("Failed to fetch app config:", err);
            }
        };
        fetchConfig();
    }, []);

    return (
        <AuthContext.Provider value={authManager}>
            <NotificationProvider>
                <AppContent config={config} />
            </NotificationProvider>
        </AuthContext.Provider>
    );
};


export default App;