import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { MainLayout } from "@/components/layout/main-layout";

import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import AcceptInvite from "@/pages/accept-invite";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import ProjectDetail from "@/pages/project-detail";
import AiTasks from "@/pages/ai-tasks";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";
import Team from "@/pages/team";
import AuditLog from "@/pages/audit-log";
import ApiKeys from "@/pages/api-keys";
import Webhooks from "@/pages/webhooks";
import Integrations from "@/pages/integrations";
import Notifications from "@/pages/notifications";
import Competitors from "@/pages/competitors";
import GeoAeo from "@/pages/geo-aeo";
import Rankings from "@/pages/rankings";
import Analytics from "@/pages/analytics";
import Usage from "@/pages/usage";
import Templates from "@/pages/templates";
import CustomFields from "@/pages/custom-fields";
import ReportSchedules from "@/pages/report-schedules";
import GDPRSettings from "@/pages/gdpr";

const queryClient = new QueryClient();

function PL({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/accept-invite" component={AcceptInvite} />

      <Route path="/dashboard">
        <PL>
          <Dashboard />
        </PL>
      </Route>
      <Route path="/clients">
        <PL>
          <Clients />
        </PL>
      </Route>
      <Route path="/clients/:clientId">
        <PL>
          <ClientDetail />
        </PL>
      </Route>
      <Route path="/clients/:clientId/projects/:projectId/:tab?">
        <PL>
          <ProjectDetail />
        </PL>
      </Route>
      <Route path="/ai-tasks">
        <PL>
          <AiTasks />
        </PL>
      </Route>
      <Route path="/billing">
        <PL>
          <Billing />
        </PL>
      </Route>
      <Route path="/settings">
        <PL>
          <Settings />
        </PL>
      </Route>

      {/* Phase 11–18 */}
      <Route path="/team">
        <PL>
          <Team />
        </PL>
      </Route>
      <Route path="/audit-log">
        <PL>
          <AuditLog />
        </PL>
      </Route>
      <Route path="/api-keys">
        <PL>
          <ApiKeys />
        </PL>
      </Route>
      <Route path="/webhooks">
        <PL>
          <Webhooks />
        </PL>
      </Route>
      <Route path="/integrations">
        <PL>
          <Integrations />
        </PL>
      </Route>

      {/* Phase 19–39 */}
      <Route path="/notifications">
        <PL>
          <Notifications />
        </PL>
      </Route>
      <Route path="/competitors">
        <PL>
          <Competitors />
        </PL>
      </Route>
      <Route path="/rankings">
        <PL>
          <Rankings />
        </PL>
      </Route>
      <Route path="/analytics">
        <PL>
          <Analytics />
        </PL>
      </Route>
      <Route path="/geo-aeo">
        <PL>
          <GeoAeo />
        </PL>
      </Route>
      <Route path="/usage">
        <PL>
          <Usage />
        </PL>
      </Route>
      <Route path="/templates">
        <PL>
          <Templates />
        </PL>
      </Route>
      <Route path="/custom-fields">
        <PL>
          <CustomFields />
        </PL>
      </Route>
      <Route path="/report-schedules">
        <PL>
          <ReportSchedules />
        </PL>
      </Route>
      <Route path="/privacy">
        <PL>
          <GDPRSettings />
        </PL>
      </Route>

      <Route path="/">
        <PL>
          <Dashboard />
        </PL>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
