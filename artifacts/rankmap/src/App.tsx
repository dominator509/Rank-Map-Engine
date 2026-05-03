import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { MainLayout } from "@/components/layout/main-layout";

import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import ProjectDetail from "@/pages/project-detail";
import AiTasks from "@/pages/ai-tasks";
import Billing from "@/pages/billing";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/dashboard">
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients">
        <ProtectedRoute>
          <MainLayout>
            <Clients />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients/:clientId">
        <ProtectedRoute>
          <MainLayout>
            <ClientDetail />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clients/:clientId/projects/:projectId/:tab?">
        <ProtectedRoute>
          <MainLayout>
            <ProjectDetail />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/ai-tasks">
        <ProtectedRoute>
          <MainLayout>
            <AiTasks />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/billing">
        <ProtectedRoute>
          <MainLayout>
            <Billing />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <MainLayout>
            <Settings />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/">
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
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
